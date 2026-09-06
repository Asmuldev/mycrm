/**
 * Click-to-chat helpers. Nothing here talks to WhatsApp: it builds a wa.me
 * link that opens the staff member's own WhatsApp with the message prefilled,
 * so there is no API, no cost, and no risk of the number being banned.
 */

/** Default country code for numbers written the Indonesian local way (08…). */
const DEFAULT_COUNTRY = "62";

/**
 * Turns a phone number written any of the usual ways into the digits wa.me
 * expects. Returns null when the value cannot be a real mobile number, so the
 * caller can hide the button instead of producing a broken link.
 */
export function normalizeWhatsappNumber(
  raw: string | null | undefined,
  countryCode = DEFAULT_COUNTRY,
) {
  if (!raw) return null;

  // Keep digits only; a leading + is implied by the country code handling below.
  let digits = raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");

  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("0")) {
    digits = `${countryCode}${digits.slice(1)}`;
  } else if (!digits.startsWith(countryCode) && digits.length <= 11) {
    // Bare local number without the leading zero, e.g. "81111112222".
    digits = `${countryCode}${digits}`;
  }

  // Indonesian mobile numbers land between 10 and 15 digits once prefixed.
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function whatsappLink(number: string, message: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export type TemplateVars = Record<string, string>;

/**
 * Replaces {placeholder} tokens. Unknown placeholders are left untouched so a
 * typo in the template is visible rather than silently swallowed, and empty
 * values remove the line they sit on to avoid dangling labels.
 */
export function renderTemplate(template: string, vars: TemplateVars) {
  const lines = template.split("\n").map((line) => {
    const hadPlaceholder = /\{\w+\}/.test(line);
    const filled = line.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in vars ? vars[key]! : match,
    );

    // A line that existed only to carry a placeholder — a payment link, say —
    // is dropped when that value is empty, rather than left as a blank gap.
    return hadPlaceholder && filled.trim() === "" ? null : filled;
  });

  return lines
    .filter((line): line is string => line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const DEFAULT_INVOICE_TEMPLATE = `Halo {klien},

Berikut invoice {nomor} senilai {total}, jatuh tempo {jatuh_tempo}.

{tautan_bayar}

Terima kasih,
{perusahaan}`;

export const DEFAULT_REMINDER_TEMPLATE = `Halo {klien},

Mengingatkan invoice {nomor} sebesar {sisa} yang jatuh tempo {jatuh_tempo}.

{tautan_bayar}

Terima kasih,
{perusahaan}`;

export const DEFAULT_QUOTE_TEMPLATE = `Halo {klien},

Berikut penawaran {nomor} senilai {total}, berlaku sampai {berlaku_sampai}.

Silakan kabari kalau ada yang perlu disesuaikan.

Terima kasih,
{perusahaan}`;

/** Placeholders offered in the settings screen, for the help text. */
export const TEMPLATE_PLACEHOLDERS = [
  "{klien}",
  "{perusahaan}",
  "{nomor}",
  "{total}",
  "{sisa}",
  "{jatuh_tempo}",
  "{berlaku_sampai}",
  "{tautan_bayar}",
  "{tautan_portal}",
];
