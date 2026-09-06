import { formatDate, formatMoney } from "@/lib/format";
import {
  DEFAULT_INVOICE_TEMPLATE,
  DEFAULT_QUOTE_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
  normalizeWhatsappNumber,
  renderTemplate,
  whatsappLink,
} from "@/lib/whatsapp";

type Numeric = number | string | { toString(): string };

type Profile = {
  name: string;
  currency: string;
  waCountryCode: string;
  waInvoiceTemplate: string | null;
  waReminderTemplate: string | null;
  waQuoteTemplate: string | null;
};

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

/** Picks the best number on file: the primary contact's, else the client's. */
export function pickWhatsappNumber(
  client: { phone: string | null },
  contactPhone: string | null | undefined,
  countryCode: string,
) {
  return (
    normalizeWhatsappNumber(contactPhone, countryCode) ??
    normalizeWhatsappNumber(client.phone, countryCode)
  );
}

export function buildInvoiceWhatsapp(input: {
  profile: Profile;
  clientName: string;
  number: string;
  total: Numeric;
  balance: number;
  currency: string;
  dueDate: Date;
  paymentLinkUrl: string | null;
  phone: string | null;
  /** Reminder wording for an invoice already sent and now due. */
  reminder?: boolean;
}) {
  const template = input.reminder
    ? (input.profile.waReminderTemplate ?? DEFAULT_REMINDER_TEMPLATE)
    : (input.profile.waInvoiceTemplate ?? DEFAULT_INVOICE_TEMPLATE);

  const message = renderTemplate(template, {
    klien: input.clientName,
    perusahaan: input.profile.name,
    nomor: input.number,
    total: formatMoney(input.total, input.currency),
    sisa: formatMoney(input.balance, input.currency),
    jatuh_tempo: formatDate(input.dueDate),
    berlaku_sampai: formatDate(input.dueDate),
    tautan_bayar: input.paymentLinkUrl ?? "",
    tautan_portal: `${appUrl()}/portal/login`,
  });

  return {
    message,
    href: input.phone ? whatsappLink(input.phone, message) : null,
  };
}

export function buildQuoteWhatsapp(input: {
  profile: Profile;
  clientName: string;
  number: string;
  total: Numeric;
  currency: string;
  validUntil: Date;
  phone: string | null;
}) {
  const message = renderTemplate(
    input.profile.waQuoteTemplate ?? DEFAULT_QUOTE_TEMPLATE,
    {
      klien: input.clientName,
      perusahaan: input.profile.name,
      nomor: input.number,
      total: formatMoney(input.total, input.currency),
      sisa: formatMoney(input.total, input.currency),
      berlaku_sampai: formatDate(input.validUntil),
      jatuh_tempo: formatDate(input.validUntil),
      tautan_bayar: "",
      tautan_portal: `${appUrl()}/portal/login`,
    },
  );

  return {
    message,
    href: input.phone ? whatsappLink(input.phone, message) : null,
  };
}
