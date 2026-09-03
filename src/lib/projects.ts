import { toBaseAmount } from "@/lib/money";

export type TimeEntryLike = {
  minutes: number;
  billable: boolean;
  hourlyRate: number | string | { toString(): string };
  invoiceId?: string | null;
};

export type ExpenseLike = {
  amount: number | string | { toString(): string };
  exchangeRate: number | string | { toString(): string };
  billable: boolean;
  invoiceId?: string | null;
};

export function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}

/**
 * Parses "1:30", "1.5", or "90m" into minutes so time can be logged the way
 * people actually write it down.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  const clock = /^(\d+):([0-5]?\d)$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const minutes = /^(\d+(?:[.,]\d+)?)\s*m(?:enit)?$/.exec(text);
  if (minutes) return Math.round(Number(minutes[1]!.replace(",", ".")));

  const hours = /^(\d+(?:[.,]\d+)?)\s*(?:j(?:am)?|h)?$/.exec(text);
  if (hours) return Math.round(Number(hours[1]!.replace(",", ".")) * 60);

  return null;
}

/** Money already earned by logged time that has not been invoiced yet. */
export function unbilledTimeValue(entries: TimeEntryLike[]) {
  return entries
    .filter((entry) => entry.billable && !entry.invoiceId)
    .reduce(
      (sum, entry) => sum + (entry.minutes / 60) * Number(entry.hourlyRate ?? 0),
      0,
    );
}

export function projectProfit(input: {
  invoicedBase: number;
  expenses: ExpenseLike[];
}) {
  const costBase = input.expenses.reduce(
    (sum, expense) => sum + toBaseAmount(expense.amount, expense.exchangeRate),
    0,
  );
  const margin = input.invoicedBase - costBase;
  return {
    costBase,
    margin,
    marginPercent:
      input.invoicedBase > 0 ? (margin / input.invoicedBase) * 100 : 0,
  };
}
