import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * Every "today" and calendar-day boundary in this app is evaluated in the
 * company's own time zone, not the server's. Hosting in UTC would otherwise
 * shift the start of the day by seven hours for an Indonesian business.
 */
export function appTimeZone() {
  return process.env.APP_TIMEZONE || "Asia/Jakarta";
}

/** The instant at which the current calendar day started, in the app zone. */
export function startOfToday(): Date {
  const now = new TZDate(Date.now(), appTimeZone());
  now.setHours(0, 0, 0, 0);
  return new Date(now.getTime());
}

/** The instant `days` calendar days after the start of today. */
export function startOfDaysFromToday(days: number): Date {
  const now = new TZDate(Date.now(), appTimeZone());
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() + days);
  return new Date(now.getTime());
}

/**
 * Turns a `yyyy-MM-dd` value from a date input into the instant that day
 * starts in the app zone, so a due date means midnight in Jakarta.
 */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day] = match;
  const zoned = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    0,
    0,
    0,
    0,
    appTimeZone(),
  );
  return new Date(zoned.getTime());
}

export function inAppZone(value: Date | string | number) {
  return new TZDate(new Date(value).getTime(), appTimeZone());
}

export function formatInZone(value: Date | string | number, pattern: string) {
  return format(inAppZone(value), pattern);
}

/** Whole calendar days from `from` to `to`, counted in the app zone. */
export function calendarDaysBetween(from: Date, to: Date) {
  const a = inAppZone(from);
  const b = inAppZone(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
