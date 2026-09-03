"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { dateField, optionalString, toNumber } from "@/lib/format";
import { nextInvoiceNumber, recalcInvoice } from "@/lib/invoice";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseDuration } from "@/lib/projects";
import type { ProjectStatus } from "@/generated/prisma/client";

function readForm(formData: FormData) {
  const rate = toNumber(formData.get("exchangeRate"), 1);
  const budgetAmount = optionalString(formData.get("budgetAmount"));
  const budgetHours = optionalString(formData.get("budgetHours"));

  return {
    name: String(formData.get("name") ?? "").trim(),
    code: optionalString(formData.get("code")),
    clientId: String(formData.get("clientId") ?? ""),
    dealId: optionalString(formData.get("dealId")),
    status: String(formData.get("status") ?? "ACTIVE") as ProjectStatus,
    startDate: dateField(formData.get("startDate")),
    endDate: dateField(formData.get("endDate")),
    budgetAmount: budgetAmount ? toNumber(budgetAmount).toFixed(2) : null,
    budgetHours: budgetHours ? toNumber(budgetHours).toFixed(2) : null,
    hourlyRate: toNumber(formData.get("hourlyRate")).toFixed(2),
    currency: String(formData.get("currency") ?? "IDR"),
    exchangeRate: (rate > 0 ? rate : 1).toFixed(6),
    notes: optionalString(formData.get("notes")),
  };
}

export async function createProject(formData: FormData) {
  const session = await requireSession();
  const data = readForm(formData);
  if (!data.name) throw new Error("Nama proyek wajib diisi");
  if (!data.clientId) throw new Error("Klien wajib dipilih");

  const project = await prisma.project.create({ data });
  await recordAudit(session, {
    action: "project.create",
    entity: "Project",
    entityId: project.id,
    summary: `Membuat proyek "${project.name}"`,
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(id: string, formData: FormData) {
  await requireSession();
  const data = readForm(formData);
  if (!data.name) throw new Error("Nama proyek wajib diisi");

  await prisma.project.update({ where: { id }, data });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  const session = await requireAdmin();
  const project = await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit(session, {
    action: "project.delete",
    entity: "Project",
    entityId: id,
    summary: `Memindahkan proyek "${project.name}" ke sampah`,
  });
  revalidatePath("/projects");
  redirect("/projects");
}

export type TimeEntryState = { error?: string; success?: string };

export async function logTime(
  projectId: string,
  _prev: TimeEntryState,
  formData: FormData,
): Promise<TimeEntryState> {
  const session = await requireSession();

  const minutes = parseDuration(String(formData.get("duration") ?? ""));
  if (!minutes || minutes <= 0) {
    return { error: 'Durasi tidak terbaca. Contoh: "1:30", "1,5", atau "90m".' };
  }

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Keterangan pekerjaan wajib diisi" };

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Proyek tidak ditemukan" };

  const rateInput = optionalString(formData.get("hourlyRate"));
  await prisma.timeEntry.create({
    data: {
      projectId,
      taskId: optionalString(formData.get("taskId")),
      userId: session.userId,
      spentOn: dateField(formData.get("spentOn")) ?? new Date(),
      minutes,
      description,
      billable: formData.get("billable") !== null,
      // Falls back to the project rate so the value is fixed at logging time.
      hourlyRate: rateInput
        ? toNumber(rateInput).toFixed(2)
        : project.hourlyRate,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: "Waktu tercatat" };
}

export async function deleteTimeEntry(
  projectId: string,
  entryId: string,
): Promise<ActionResult> {
  await requireSession();
  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (entry?.invoiceId) {
    return {
      error: "Entri ini sudah ditagihkan. Batalkan invoicenya dulu.",
    };
  }

  await prisma.timeEntry.delete({ where: { id: entryId } });
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Turns every unbilled billable time entry and billable expense on a project
 * into a draft invoice, then marks them as billed so they cannot go out twice.
 */
export async function invoiceProjectWork(projectId: string) {
  const session = await requireSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      timeEntries: { where: { billable: true, invoiceId: null } },
      expenses: { where: { billable: true, invoiceId: null, deletedAt: null } },
    },
  });
  if (!project) throw new Error("Proyek tidak ditemukan");

  if (project.timeEntries.length === 0 && project.expenses.length === 0) {
    throw new Error("Tidak ada waktu atau biaya yang belum ditagihkan");
  }

  // One line per rate so a rate change mid-project stays visible on the invoice.
  const byRate = new Map<string, { minutes: number; rate: number }>();
  for (const entry of project.timeEntries) {
    const rate = Number(entry.hourlyRate);
    const key = rate.toFixed(2);
    const row = byRate.get(key) ?? { minutes: 0, rate };
    row.minutes += entry.minutes;
    byRate.set(key, row);
  }

  const items = [
    ...[...byRate.values()].map((row, index) => ({
      description: `Jasa ${project.name} (${(row.minutes / 60).toFixed(2)} jam)`,
      quantity: (row.minutes / 60).toFixed(2),
      unitPrice: row.rate.toFixed(2),
      amount: ((row.minutes / 60) * row.rate).toFixed(2),
      position: index,
    })),
    ...project.expenses.map((expense, index) => ({
      description: `Biaya: ${expense.description}`,
      quantity: "1",
      unitPrice: Number(expense.amount).toFixed(2),
      amount: Number(expense.amount).toFixed(2),
      position: byRate.size + index,
    })),
  ];

  const profile = await prisma.companyProfile.findUnique({
    where: { id: "default" },
  });

  const invoice = await prisma.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      clientId: project.clientId,
      projectId: project.id,
      status: "DRAFT",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      currency: project.currency,
      exchangeRate: project.exchangeRate,
      taxRate: profile?.defaultTaxRate ?? "0",
      withholdingRate: profile?.defaultWithholdingRate ?? "0",
      terms: profile?.defaultTerms ?? null,
      items: { create: items },
    },
  });

  await prisma.$transaction([
    prisma.timeEntry.updateMany({
      where: { id: { in: project.timeEntries.map((entry) => entry.id) } },
      data: { invoiceId: invoice.id },
    }),
    prisma.expense.updateMany({
      where: { id: { in: project.expenses.map((expense) => expense.id) } },
      data: { invoiceId: invoice.id },
    }),
  ]);

  await recalcInvoice(invoice.id);
  await recordAudit(session, {
    action: "project.invoice",
    entity: "Project",
    entityId: projectId,
    summary: `Menagihkan pekerjaan proyek "${project.name}" lewat ${invoice.number}`,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}
