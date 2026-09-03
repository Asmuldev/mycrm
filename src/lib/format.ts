import { formatInZone, parseDateInput } from "@/lib/time";

export function formatMoney(
  value: number | string | { toString(): string },
  currency = "IDR",
) {
  const amount = Number(value ?? 0);
  const fractionDigits = currency === "IDR" ? 0 : 2;
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumber(value: number | string) {
  return new Intl.NumberFormat("id-ID").format(Number(value ?? 0));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return formatInZone(value, "dd MMM yyyy");
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return formatInZone(value, "dd MMM yyyy HH:mm");
}

export function formatDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  return formatInZone(value, "yyyy-MM-dd");
}

/** Reads a `yyyy-MM-dd` form field as a calendar day in the company zone. */
export function dateField(value: FormDataEntryValue | null) {
  return parseDateInput(optionalString(value));
}

export function toNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (value === null) return fallback;
  const parsed = Number(String(value).replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

/**
 * ISO timestamp `days` from now, for prefilling date inputs on the server.
 * Kept out of components so render stays free of clock reads.
 */
export function daysFromNowIso(days = 0) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
