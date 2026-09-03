import { renderToBuffer } from "@react-pdf/renderer";
import { emailShell, sendEmail } from "@/lib/email";
import { formatDate, formatMoney } from "@/lib/format";
import { getInvoiceView, type InvoiceView } from "@/lib/invoice-view";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function renderInvoicePdf(view: InvoiceView) {
  return renderToBuffer(InvoicePdf({ view }));
}

type InvoiceEmailKind = "invoice_sent" | "invoice_reminder" | "invoice_overdue";

const headings: Record<InvoiceEmailKind, string> = {
  invoice_sent: "Invoice baru",
  invoice_reminder: "Pengingat jatuh tempo",
  invoice_overdue: "Invoice lewat jatuh tempo",
};

/**
 * Emails an invoice with its PDF attached. Returns a skipped result instead of
 * throwing when the client has no email on file.
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  kind: InvoiceEmailKind,
  extraMessage?: string,
) {
  const view = await getInvoiceView(invoiceId);
  if (!view) return { ok: false as const, error: "Invoice tidak ditemukan" };

  const { company, invoice, client } = view;
  if (!client.email) {
    return { ok: false as const, error: "Klien belum punya alamat email" };
  }

  const dueLabel = formatDate(invoice.dueDate);
  const balance = formatMoney(invoice.balance, invoice.currency);
  const lines: string[] = [
    `<p>Halo ${client.name},</p>`,
    kind === "invoice_sent"
      ? `<p>Berikut invoice <strong>${invoice.number}</strong> senilai <strong>${formatMoney(invoice.total, invoice.currency)}</strong>, jatuh tempo <strong>${dueLabel}</strong>. PDF terlampir.</p>`
      : kind === "invoice_reminder"
        ? `<p>Mengingatkan invoice <strong>${invoice.number}</strong> akan jatuh tempo pada <strong>${dueLabel}</strong>. Sisa tagihan <strong>${balance}</strong>.</p>`
        : `<p>Invoice <strong>${invoice.number}</strong> sudah melewati jatuh tempo <strong>${dueLabel}</strong>. Sisa tagihan <strong>${balance}</strong>.</p>`,
  ];

  if (extraMessage) {
    lines.push(`<p>${extraMessage.replace(/\n/g, "<br/>")}</p>`);
  }
  if (company.bankName || company.bankAccount) {
    lines.push(
      `<p style="margin-top:16px;font-size:13px;color:#475569;">Pembayaran ke ${[company.bankName, company.bankAccount, company.bankHolder ? `a.n. ${company.bankHolder}` : null].filter(Boolean).join(" · ")}</p>`,
    );
  }

  const pdf = await renderInvoicePdf(view);

  return sendEmail({
    to: client.email,
    kind,
    invoiceId: invoice.id,
    subject: `${headings[kind]} ${invoice.number} — ${company.name}`,
    fromName: company.name,
    replyTo: company.emailReplyTo ?? null,
    html: emailShell({
      accent: company.accentColor,
      heading: `${headings[kind]} ${invoice.number}`,
      body: lines.join(""),
      cta: invoice.paymentLinkUrl
        ? { label: "Bayar sekarang", url: invoice.paymentLinkUrl }
        : undefined,
      footer: `${company.name}${company.email ? ` · ${company.email}` : ""} · ${appUrl()}`,
    }),
    text: `${headings[kind]} ${invoice.number}. Jatuh tempo ${dueLabel}. Sisa tagihan ${balance}.`,
    attachments: [
      {
        filename: `${invoice.number.replace(/\//g, "-")}.pdf`,
        content: pdf,
      },
    ],
  });
}
