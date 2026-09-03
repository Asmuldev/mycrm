"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { dateField, optionalString, toNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { advanceDate, firstRunDate, runDueRecurringInvoices } from "@/lib/recurring";
import type { RecurringFrequency } from "@/generated/prisma/client";

function readItems(formData: FormData) {
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const prices = formData.getAll("itemUnitPrice");

  return descriptions
    .map((description, index) => ({
      description: String(description ?? "").trim(),
      quantity: toNumber(quantities[index] ?? null, 0).toFixed(2),
      unitPrice: toNumber(prices[index] ?? null, 0).toFixed(2),
      position: index,
    }))
    .filter((item) => item.description.length > 0);
}

function readForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    clientId: String(formData.get("clientId") ?? ""),
    frequency: String(formData.get("frequency") ?? "MONTHLY") as RecurringFrequency,
    interval: Math.max(toNumber(formData.get("interval"), 1), 1),
    startDate: dateField(formData.get("startDate")) ?? new Date(),
    endDate: dateField(formData.get("endDate")),
    dueInDays: Math.max(toNumber(formData.get("dueInDays"), 14), 0),
    currency: String(formData.get("currency") ?? "IDR"),
    exchangeRate: (toNumber(formData.get("exchangeRate"), 1) > 0
      ? toNumber(formData.get("exchangeRate"), 1)
      : 1
    ).toFixed(6),
    discount: toNumber(formData.get("discount")).toFixed(2),
    taxRate: toNumber(formData.get("taxRate")).toFixed(2),
    withholdingRate: toNumber(formData.get("withholdingRate")).toFixed(2),
    notes: optionalString(formData.get("notes")),
    terms: optionalString(formData.get("terms")),
    autoSend: formData.get("autoSend") === "on",
    active: formData.get("active") !== "off",
  };
}

export async function createRecurring(formData: FormData) {
  const session = await requireSession();
  const data = readForm(formData);
  const items = readItems(formData);

  if (!data.title) throw new Error("Judul wajib diisi");
  if (!data.clientId) throw new Error("Klien wajib dipilih");
  if (items.length === 0) throw new Error("Minimal satu item");

  const template = await prisma.recurringInvoice.create({
    data: {
      ...data,
      nextRunAt: firstRunDate(data.startDate),
      items: { create: items },
    },
  });

  await recordAudit(session, {
    action: "recurring.create",
    entity: "RecurringInvoice",
    entityId: template.id,
    summary: `Membuat langganan "${template.title}"`,
  });

  revalidatePath("/recurring");
  redirect(`/recurring/${template.id}`);
}

export async function updateRecurring(id: string, formData: FormData) {
  await requireSession();
  const data = readForm(formData);
  const items = readItems(formData);

  if (!data.title) throw new Error("Judul wajib diisi");
  if (items.length === 0) throw new Error("Minimal satu item");

  const current = await prisma.recurringInvoice.findUnique({ where: { id } });
  if (!current) throw new Error("Langganan tidak ditemukan");

  // Only reset the schedule when the cadence itself changed.
  const cadenceChanged =
    current.frequency !== data.frequency ||
    current.interval !== data.interval ||
    current.startDate.getTime() !== data.startDate.getTime();

  await prisma.$transaction([
    prisma.recurringInvoiceItem.deleteMany({ where: { recurringInvoiceId: id } }),
    prisma.recurringInvoice.update({
      where: { id },
      data: {
        ...data,
        nextRunAt: cadenceChanged ? firstRunDate(data.startDate) : current.nextRunAt,
        items: { create: items },
      },
    }),
  ]);

  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  redirect(`/recurring/${id}`);
}

export async function toggleRecurring(id: string) {
  await requireSession();
  const current = await prisma.recurringInvoice.findUnique({ where: { id } });
  if (!current) return;

  await prisma.recurringInvoice.update({
    where: { id },
    data: { active: !current.active },
  });
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
}

export async function deleteRecurring(id: string) {
  const session = await requireAdmin();
  const template = await prisma.recurringInvoice.delete({ where: { id } });
  await recordAudit(session, {
    action: "recurring.delete",
    entity: "RecurringInvoice",
    entityId: id,
    summary: `Menghapus langganan "${template.title}"`,
  });
  revalidatePath("/recurring");
  redirect("/recurring");
}

/** Generates the next invoice immediately, without waiting for the cron. */
export async function runRecurringNow(id: string) {
  await requireSession();
  await prisma.recurringInvoice.update({
    where: { id },
    data: { nextRunAt: new Date() },
  });
  await runDueRecurringInvoices();
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  revalidatePath("/invoices");
}

export async function skipNextRun(id: string) {
  await requireSession();
  const current = await prisma.recurringInvoice.findUnique({ where: { id } });
  if (!current) return;

  await prisma.recurringInvoice.update({
    where: { id },
    data: {
      nextRunAt: advanceDate(current.nextRunAt, current.frequency, current.interval),
    },
  });
  revalidatePath(`/recurring/${id}`);
}
