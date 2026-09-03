"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { emailShell, sendEmail } from "@/lib/email";
import {
  dateField,
  formatDate,
  formatMoney,
  optionalString,
  toNumber,
} from "@/lib/format";
import {
  getCompanyProfile,
  nextInvoiceNumber,
  nextQuoteNumber,
  recalcInvoice,
  recalcQuote,
} from "@/lib/invoice";
import { getQuoteView } from "@/lib/invoice-view";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { QuoteStatus } from "@/generated/prisma/client";

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

function readForm(formData: FormData) {
  const rate = toNumber(formData.get("exchangeRate"), 1);

  return {
    clientId: String(formData.get("clientId") ?? ""),
    dealId: optionalString(formData.get("dealId")),
    status: String(formData.get("status") ?? "DRAFT") as QuoteStatus,
    issueDate: dateField(formData.get("issueDate")) ?? new Date(),
    validUntil: dateField(formData.get("validUntil")) ?? new Date(),
    currency: String(formData.get("currency") ?? "IDR"),
    exchangeRate: (rate > 0 ? rate : 1).toFixed(6),
    discount: toNumber(formData.get("discount")).toFixed(2),
    taxRate: toNumber(formData.get("taxRate")).toFixed(2),
    notes: optionalString(formData.get("notes")),
    terms: optionalString(formData.get("terms")),
  };
}

export async function createQuote(formData: FormData) {
  const session = await requireSession();
  const data = readForm(formData);
  const items = readItems(formData);

  if (!data.clientId) throw new Error("Klien wajib dipilih");
  if (items.length === 0) throw new Error("Minimal satu item penawaran");

  const quote = await prisma.quote.create({
    data: { ...data, number: await nextQuoteNumber(), items: { create: items } },
  });
  await recalcQuote(quote.id);
  await recordAudit(session, {
    action: "quote.create",
    entity: "Quote",
    entityId: quote.id,
    summary: `Membuat penawaran ${quote.number}`,
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

export async function updateQuote(id: string, formData: FormData) {
  await requireSession();
  const data = readForm(formData);
  const items = readItems(formData);
  if (items.length === 0) throw new Error("Minimal satu item penawaran");

  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId: id } }),
    prisma.quote.update({ where: { id }, data: { ...data, items: { create: items } } }),
  ]);
  await recalcQuote(id);

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function setQuoteStatus(id: string, status: QuoteStatus) {
  const session = await requireSession();
  const quote = await prisma.quote.update({ where: { id }, data: { status } });
  await recordAudit(session, {
    action: "quote.status",
    entity: "Quote",
    entityId: id,
    summary: `Status penawaran ${quote.number} menjadi ${status}`,
  });
  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
}

export async function deleteQuote(id: string) {
  const session = await requireAdmin();
  const quote = await prisma.quote.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit(session, {
    action: "quote.delete",
    entity: "Quote",
    entityId: id,
    summary: `Memindahkan penawaran ${quote.number} ke sampah`,
  });
  revalidatePath("/quotes");
  redirect("/quotes");
}

export type QuoteActionState = { error?: string; success?: string };

export async function sendQuote(
  quoteId: string,
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const session = await requireSession();
  const view = await getQuoteView(quoteId);
  if (!view) return { error: "Penawaran tidak ditemukan" };
  if (!view.client.email) return { error: "Klien belum punya alamat email" };

  const profile = await getCompanyProfile();
  const message = optionalString(formData.get("message"));

  const result = await sendEmail({
    to: view.client.email,
    kind: "quote_sent",
    subject: `Penawaran ${view.invoice.number} — ${profile.name}`,
    fromName: profile.emailFromName ?? profile.name,
    replyTo: profile.emailReplyTo,
    html: emailShell({
      accent: profile.accentColor,
      heading: `Penawaran ${view.invoice.number}`,
      body: `<p>Halo ${view.client.name},</p><p>Berikut penawaran senilai <strong>${formatMoney(view.invoice.total, view.invoice.currency)}</strong>, berlaku sampai <strong>${formatDate(view.invoice.dueDate)}</strong>.</p>${
        message ? `<p>${message.replace(/\n/g, "<br/>")}</p>` : ""
      }`,
      footer: profile.name,
    }),
    text: `Penawaran ${view.invoice.number} berlaku sampai ${formatDate(view.invoice.dueDate)}.`,
  });

  await prisma.quote.update({
    where: { id: quoteId },
    data: { sentAt: new Date(), status: "SENT" },
  });
  await recordAudit(session, {
    action: "quote.send",
    entity: "Quote",
    entityId: quoteId,
    summary: `Mengirim penawaran ${view.invoice.number}`,
  });

  revalidatePath(`/quotes/${quoteId}`);

  if (!result.ok && "skipped" in result) {
    return {
      success:
        "Penawaran ditandai terkirim, tapi email tidak dikirim karena RESEND_API_KEY belum diisi.",
    };
  }
  if (!result.ok) return { error: result.error ?? "Gagal mengirim email" };
  return { success: "Penawaran terkirim ke email klien" };
}

/** Copies an accepted quote into a draft invoice and links the two. */
export async function convertQuoteToInvoice(quoteId: string) {
  const session = await requireSession();
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!quote) throw new Error("Penawaran tidak ditemukan");
  if (quote.invoiceId) throw new Error("Penawaran ini sudah dikonversi");

  const profile = await getCompanyProfile();
  const invoice = await prisma.invoice.create({
    data: {
      number: await nextInvoiceNumber(),
      clientId: quote.clientId,
      status: "DRAFT",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      currency: quote.currency,
      exchangeRate: quote.exchangeRate,
      discount: quote.discount,
      taxRate: quote.taxRate,
      withholdingRate: profile.defaultWithholdingRate,
      notes: quote.notes,
      terms: quote.terms ?? profile.defaultTerms,
      items: {
        create: quote.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          position: item.position,
        })),
      },
    },
  });

  await recalcInvoice(invoice.id);
  await prisma.quote.update({
    where: { id: quoteId },
    data: { invoiceId: invoice.id, status: "ACCEPTED" },
  });
  await recordAudit(session, {
    action: "quote.convert",
    entity: "Quote",
    entityId: quoteId,
    summary: `Mengonversi ${quote.number} menjadi invoice ${invoice.number}`,
  });

  revalidatePath("/quotes");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}
