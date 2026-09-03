"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { dateField, optionalString, toNumber } from "@/lib/format";
import {
  nextCreditNoteNumber,
  recalcCreditNote,
  recalcInvoice,
} from "@/lib/invoice";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function readItems(formData: FormData) {
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const prices = formData.getAll("itemUnitPrice");

  return descriptions
    .map((description, index) => {
      const quantity = toNumber(quantities[index] ?? null, 0);
      const unitPrice = toNumber(prices[index] ?? null, 0);
      return {
        description: String(description ?? "").trim(),
        quantity: quantity.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        amount: (quantity * unitPrice).toFixed(2),
        position: index,
      };
    })
    .filter((item) => item.description.length > 0);
}

export async function createCreditNote(formData: FormData) {
  const session = await requireSession();

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice tidak ditemukan");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("Alasan koreksi wajib diisi");

  const items = readItems(formData);
  if (items.length === 0) throw new Error("Minimal satu baris koreksi");

  const note = await prisma.creditNote.create({
    data: {
      number: await nextCreditNoteNumber(),
      invoiceId,
      clientId: invoice.clientId,
      issueDate: dateField(formData.get("issueDate")) ?? new Date(),
      reason,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      taxRate: invoice.taxRate,
      notes: optionalString(formData.get("notes")),
      items: { create: items },
    },
  });

  await recalcCreditNote(note.id);
  await recordAudit(session, {
    action: "credit_note.create",
    entity: "CreditNote",
    entityId: note.id,
    summary: `Membuat nota kredit ${note.number} untuk ${invoice.number}`,
  });

  revalidatePath("/credit-notes");
  redirect(`/credit-notes/${note.id}`);
}

/**
 * A draft note has no effect on the invoice. Issuing it is what reduces the
 * outstanding balance, so it stays an explicit, audited step.
 */
export async function issueCreditNote(id: string) {
  const session = await requireSession();
  const note = await prisma.creditNote.update({
    where: { id },
    data: { status: "ISSUED" },
    include: { invoice: { select: { number: true } } },
  });

  await recalcInvoice(note.invoiceId);
  await recordAudit(session, {
    action: "credit_note.issue",
    entity: "CreditNote",
    entityId: id,
    summary: `Menerbitkan nota kredit ${note.number} atas ${note.invoice.number}`,
  });

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  revalidatePath(`/invoices/${note.invoiceId}`);
}

export async function cancelCreditNote(id: string) {
  const session = await requireSession();
  const note = await prisma.creditNote.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await recalcInvoice(note.invoiceId);
  await recordAudit(session, {
    action: "credit_note.cancel",
    entity: "CreditNote",
    entityId: id,
    summary: `Membatalkan nota kredit ${note.number}`,
  });

  revalidatePath("/credit-notes");
  revalidatePath(`/credit-notes/${id}`);
  revalidatePath(`/invoices/${note.invoiceId}`);
}

export async function deleteCreditNote(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const note = await prisma.creditNote.findUnique({ where: { id } });
  if (!note) return { error: "Nota kredit tidak ditemukan" };
  if (note.status === "ISSUED") {
    return {
      error: "Nota kredit yang sudah terbit harus dibatalkan, bukan dihapus.",
    };
  }

  await prisma.creditNote.delete({ where: { id } });
  await recalcInvoice(note.invoiceId);
  await recordAudit(session, {
    action: "credit_note.delete",
    entity: "CreditNote",
    entityId: id,
    summary: `Menghapus draft nota kredit ${note.number}`,
  });

  revalidatePath("/credit-notes");
  redirect("/credit-notes");
}
