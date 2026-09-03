import { addMonths, addWeeks, addYears } from "date-fns";

export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

/** Pure cadence maths, kept free of database imports so it stays testable. */
export function advanceDate(
  from: Date,
  frequency: RecurringFrequency,
  interval: number,
) {
  const step = Math.max(Math.floor(interval) || 1, 1);
  switch (frequency) {
    case "WEEKLY":
      return addWeeks(from, step);
    case "QUARTERLY":
      return addMonths(from, step * 3);
    case "YEARLY":
      return addYears(from, step);
    case "MONTHLY":
    default:
      return addMonths(from, step);
  }
}

/**
 * Every run date from `nextRunAt` up to and including `now`, so a server that
 * was down for a cycle still bills every period it missed.
 */
export function dueRunDates(
  nextRunAt: Date,
  now: Date,
  frequency: RecurringFrequency,
  interval: number,
  endDate: Date | null,
  maxRuns = 24,
) {
  const runs: Date[] = [];
  let cursor = nextRunAt;

  while (cursor <= now && runs.length < maxRuns) {
    if (endDate && cursor > endDate) break;
    runs.push(cursor);
    cursor = advanceDate(cursor, frequency, interval);
  }

  return { runs, nextRunAt: cursor };
}
