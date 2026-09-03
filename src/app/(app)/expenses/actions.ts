"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { dateField, optionalString, toNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function readForm(formData: FormData) {
  const rate = toNumber(formData.get("exchangeRate"), 1);

  return {
    spentOn: dateField(formData.get("spentOn")) ?? new Date(),
    description: String(formData.get("description") ?? "").trim(),
    category: String(formData.get("category") ?? "LAINNYA"),
    vendor: optionalString(formData.get("vendor")),
    amount: toNumber(formData.get("amount")).toFixed(2),
    currency: String(formData.get("currency") ?? "IDR"),
    exchangeRate: (rate > 0 ? rate : 1).toFixed(6),
    billable: formData.get("billable") !== null,
    clientId: optionalString(formData.get("clientId")),
    projectId: optionalString(formData.get("projectId")),
    notes: optionalString(formData.get("notes")),
  };
}

export async function createExpense(formData: FormData) {
  const session = await requireSession();
  const data = readForm(formData);

  if (!data.description) throw new Error("Keterangan biaya wajib diisi");
  if (Number(data.amount) <= 0) throw new Error("Nominal harus lebih dari 0");

  const expense = await prisma.expense.create({
    data: { ...data, createdById: session.userId },
  });
  await recordAudit(session, {
    action: "expense.create",
    entity: "Expense",
    entityId: expense.id,
    summary: `Mencatat biaya "${expense.description}"`,
  });

  revalidatePath("/expenses");
  redirect(`/expenses/${expense.id}`);
}

export async function updateExpense(id: string, formData: FormData) {
  await requireSession();
  const data = readForm(formData);

  if (!data.description) throw new Error("Keterangan biaya wajib diisi");
  if (Number(data.amount) <= 0) throw new Error("Nominal harus lebih dari 0");

  const current = await prisma.expense.findUnique({ where: { id } });
  if (current?.invoiceId) {
    throw new Error("Biaya ini sudah ditagihkan dan tidak bisa diubah");
  }

  await prisma.expense.update({ where: { id }, data });
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  redirect(`/expenses/${id}`);
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const current = await prisma.expense.findUnique({ where: { id } });
  if (current?.invoiceId) {
    return {
      error: "Biaya ini sudah ditagihkan. Batalkan invoicenya dulu.",
    };
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit(session, {
    action: "expense.delete",
    entity: "Expense",
    entityId: id,
    summary: `Memindahkan biaya "${expense.description}" ke sampah`,
  });

  revalidatePath("/expenses");
  redirect("/expenses");
}
