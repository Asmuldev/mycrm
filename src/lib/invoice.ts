import { computeInvoiceTotals, deriveInvoiceStatus } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { startOfToday } from "@/lib/time";

export async function getCompanyProfile() {
  const existing = await prisma.companyProfile.findUnique({
    where: { id: "default" },
  });
  if (existing) return existing;
  return prisma.companyProfile.create({ data: { id: "default" } });
}

/** Highest sequence already used by existing documents of this kind and year. */
async function highestExistingSequence(
  kind: string,
  prefix: string,
  year: number,
) {
  const start = `${prefix}/${year}/`;

  const latest =
    kind === "quote"
      ? await prisma.quote.findFirst({
          where: { number: { startsWith: start } },
          orderBy: { number: "desc" },
          select: { number: true },
        })
      : kind === "credit_note"
        ? await prisma.creditNote.findFirst({
            where: { number: { startsWith: start } },
            orderBy: { number: "desc" },
            select: { number: true },
          })
        : await prisma.invoice.findFirst({
            where: { number: { startsWith: start } },
            orderBy: { number: "desc" },
            select: { number: true },
          });

  const sequence = latest ? Number(latest.number.slice(start.length)) : 0;
  return Number.isFinite(sequence) ? sequence : 0;
}

/**
 * Reserves the next sequence for a document kind. The counter row is updated
 * atomically, so two concurrent creates can never claim the same number.
 *
 * The counter can still fall behind reality — documents imported from another
 * system, or created before this counter existed. Rather than failing forever
 * on a unique-constraint error, the reservation skips past any number that is
 * already taken.
 */
async function reserveNumber(kind: string, prefix: string) {
  const year = startOfToday().getFullYear();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const counter = await prisma.documentCounter.upsert({
      where: { kind_year: { kind, year } },
      create: { kind, year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
      select: { lastNumber: true },
    });

    const highest = await highestExistingSequence(kind, prefix, year);
    if (counter.lastNumber > highest) {
      return `${prefix}/${year}/${String(counter.lastNumber).padStart(4, "0")}`;
    }

    // Catch the counter up in one step instead of incrementing one at a time.
    await prisma.documentCounter.update({
      where: { kind_year: { kind, year } },
      data: { lastNumber: highest },
    });
  }

  throw new Error(
    `Gagal mendapatkan nomor ${prefix} yang belum terpakai. Periksa tabel DocumentCounter.`,
  );
}

export async function nextInvoiceNumber() {
  const profile = await getCompanyProfile();
  return reserveNumber("invoice", profile.invoicePrefix);
}

export async function nextQuoteNumber() {
  return reserveNumber("quote", "QUO");
}

/** Recomputes a quote's monetary totals from its items. */
export async function recalcQuote(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  });
  if (!quote) return null;

  const totals = computeInvoiceTotals({
    items: quote.items.map((item) => ({
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
    discount: Number(quote.discount),
    taxRate: Number(quote.taxRate),
  });

  return prisma.quote.update({
    where: { id: quoteId },
    data: {
      subtotal: totals.subtotal.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      total: totals.total.toFixed(2),
    },
  });
}

/** Marks quotes past their validity date as expired. */
export async function syncExpiredQuotes() {
  await prisma.quote.updateMany({
    where: { status: "SENT", validUntil: { lt: startOfToday() }, deletedAt: null },
    data: { status: "EXPIRED" },
  });
}

/** Recomputes subtotal/tax/total/amountPaid and derives status. */
export async function recalcInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      payments: true,
      creditNotes: { where: { status: "ISSUED", deletedAt: null } },
    },
  });
  if (!invoice) return null;

  const totals = computeInvoiceTotals({
    items: invoice.items.map((item) => ({
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
    discount: Number(invoice.discount),
    taxRate: Number(invoice.taxRate),
    withholdingRate: Number(invoice.withholdingRate),
    lateFeeAmount: Number(invoice.lateFeeAmount),
  });
  const { subtotal, taxAmount, withholdingAmount, total } = totals;
  const amountPaid = invoice.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const creditedAmount = invoice.creditNotes.reduce(
    (sum, note) => sum + Number(note.total),
    0,
  );

  const status = deriveInvoiceStatus({
    current: invoice.status,
    total,
    amountPaid,
    creditedAmount,
    dueDate: new Date(invoice.dueDate),
    today: startOfToday(),
  }) as typeof invoice.status;

  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      withholdingAmount: withholdingAmount.toFixed(2),
      total: total.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      creditedAmount: creditedAmount.toFixed(2),
      status,
    },
  });
}

/** Flags unpaid, past-due invoices as OVERDUE. Cheap enough to run on list load. */
export async function syncOverdueInvoices() {
  await prisma.invoice.updateMany({
    where: {
      status: { in: ["SENT", "PARTIAL"] },
      dueDate: { lt: startOfToday() },
      deletedAt: null,
    },
    data: { status: "OVERDUE" },
  });
}

export async function nextCreditNoteNumber() {
  return reserveNumber("credit_note", "NK");
}

/** Recomputes a credit note's totals from its lines. */
export async function recalcCreditNote(creditNoteId: string) {
  const note = await prisma.creditNote.findUnique({
    where: { id: creditNoteId },
    include: { items: true },
  });
  if (!note) return null;

  const totals = computeInvoiceTotals({
    items: note.items.map((item) => ({
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
    discount: 0,
    taxRate: Number(note.taxRate),
  });

  const updated = await prisma.creditNote.update({
    where: { id: creditNoteId },
    data: {
      subtotal: totals.subtotal.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      total: totals.total.toFixed(2),
    },
  });

  await recalcInvoice(note.invoiceId);
  return updated;
}
