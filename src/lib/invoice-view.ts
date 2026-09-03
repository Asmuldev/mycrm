import { notFound } from "next/navigation";
import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";

/**
 * Flattens an invoice, its client, and the company profile into plain JSON.
 * Shared by the HTML print page and the PDF renderer so both stay in sync.
 */
export async function getInvoiceView(id: string) {
  const [invoice, profile] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: { orderBy: { position: "asc" } },
        payments: { orderBy: { paidAt: "asc" } },
        schedules: { orderBy: { position: "asc" } },
      },
    }),
    getCompanyProfile(),
  ]);

  if (!invoice || invoice.deletedAt) return null;

  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amountPaid);

  return {
    company: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      taxId: profile.taxId,
      logoUrl: profile.logoUrl,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      bankHolder: profile.bankHolder,
      accentColor: profile.accentColor,
      emailReplyTo: profile.emailReplyTo,
    },
    invoice: {
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      taxRate: Number(invoice.taxRate),
      taxAmount: Number(invoice.taxAmount),
      withholdingRate: Number(invoice.withholdingRate),
      withholdingAmount: Number(invoice.withholdingAmount),
      total,
      amountPaid,
      balance: total - amountPaid,
      notes: invoice.notes,
      terms: invoice.terms,
      paymentLinkUrl: invoice.paymentLinkUrl,
      sentAt: invoice.sentAt?.toISOString() ?? null,
      // Lets callers confirm ownership without a second query.
      clientOwnerId: invoice.clientId,
    },
    client: {
      name: invoice.client.name,
      company: invoice.client.company,
      email: invoice.client.email,
      phone: invoice.client.phone,
      address: invoice.client.address,
      city: invoice.client.city,
      country: invoice.client.country,
      taxId: invoice.client.taxId,
    },
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
    })),
    schedules: invoice.schedules.map((schedule) => ({
      id: schedule.id,
      label: schedule.label,
      dueDate: schedule.dueDate.toISOString(),
      amount: Number(schedule.amount),
      paidAt: schedule.paidAt?.toISOString() ?? null,
    })),
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paidAt: payment.paidAt.toISOString(),
      method: payment.method,
      reference: payment.reference,
    })),
  };
}

export type InvoiceView = NonNullable<Awaited<ReturnType<typeof getInvoiceView>>>;

export async function requireInvoiceView(id: string): Promise<InvoiceView> {
  const view = await getInvoiceView(id);
  if (!view) notFound();
  return view;
}

/** Builds the client address block used on both templates. */
export function clientAddressLines(client: InvoiceView["client"]) {
  return [
    client.company,
    client.address,
    [client.city, client.country].filter(Boolean).join(", "),
    client.email,
    client.phone,
    client.taxId ? `NPWP: ${client.taxId}` : null,
  ].filter((line): line is string => Boolean(line && line.length));
}

export function companyAddressLines(company: InvoiceView["company"]) {
  return [
    company.address,
    company.phone,
    company.email,
    company.taxId ? `NPWP: ${company.taxId}` : null,
  ].filter((line): line is string => Boolean(line && line.length));
}

/**
 * Maps a quote onto the invoice view shape so the PDF and print templates can
 * render both documents without a second layout.
 */
export async function getQuoteView(id: string) {
  const [quote, profile] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: { client: true, items: { orderBy: { position: "asc" } } },
    }),
    getCompanyProfile(),
  ]);

  if (!quote || quote.deletedAt) return null;

  const total = Number(quote.total);

  return {
    quoteStatus: quote.status,
    company: {
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
      taxId: profile.taxId,
      logoUrl: profile.logoUrl,
      bankName: profile.bankName,
      bankAccount: profile.bankAccount,
      bankHolder: profile.bankHolder,
      accentColor: profile.accentColor,
      emailReplyTo: profile.emailReplyTo,
    },
    invoice: {
      id: quote.id,
      number: quote.number,
      // The shared template only uses status for its badge; quotes pass their
      // own label instead, so DRAFT keeps the neutral styling.
      status: "DRAFT" as InvoiceView["invoice"]["status"],
      issueDate: quote.issueDate.toISOString(),
      dueDate: quote.validUntil.toISOString(),
      currency: quote.currency,
      subtotal: Number(quote.subtotal),
      discount: Number(quote.discount),
      taxRate: Number(quote.taxRate),
      taxAmount: Number(quote.taxAmount),
      withholdingRate: 0,
      withholdingAmount: 0,
      total,
      amountPaid: 0,
      balance: total,
      notes: quote.notes,
      terms: quote.terms,
      paymentLinkUrl: null,
      sentAt: quote.sentAt?.toISOString() ?? null,
      clientOwnerId: quote.clientId,
    },
    client: {
      name: quote.client.name,
      company: quote.client.company,
      email: quote.client.email,
      phone: quote.client.phone,
      address: quote.client.address,
      city: quote.client.city,
      country: quote.client.country,
      taxId: quote.client.taxId,
    },
    items: quote.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
    })),
    schedules: [] as InvoiceView["schedules"],
    payments: [] as InvoiceView["payments"],
  } satisfies InvoiceView & { quoteStatus: string };
}
