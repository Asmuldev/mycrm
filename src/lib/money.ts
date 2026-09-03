/**
 * Aggregations must never add two currencies together. Every document stores
 * the rate to the company's base currency at the time it was issued, and all
 * totals shown across documents are converted with that stored rate.
 */
export function toBaseAmount(
  amount: number | string | { toString(): string },
  exchangeRate: number | string | { toString(): string },
) {
  const value = Number(amount ?? 0);
  const rate = Number(exchangeRate ?? 1);
  if (!Number.isFinite(value)) return 0;
  return value * (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

export type InvoiceTotalsInput = {
  items: Array<{ quantity: number | string; unitPrice: number | string }>;
  discount: number | string;
  taxRate: number | string;
  withholdingRate?: number | string;
  /** Charged on top of the taxed amount, applied by hand on overdue invoices. */
  lateFeeAmount?: number | string;
};

export type InvoiceTotals = {
  subtotal: number;
  taxable: number;
  taxAmount: number;
  withholdingAmount: number;
  lateFeeAmount: number;
  total: number;
};

/**
 * Pure money maths shared by the server actions, the live form preview, and
 * the tests. PPh 23 is withheld by the client, so it lowers what they transfer.
 */
export function computeInvoiceTotals(
  input: InvoiceTotalsInput,
): InvoiceTotals {
  const subtotal = input.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  );
  const taxable = Math.max(subtotal - Number(input.discount || 0), 0);
  const taxAmount = (taxable * Number(input.taxRate || 0)) / 100;
  const withholdingAmount =
    (taxable * Number(input.withholdingRate || 0)) / 100;
  const lateFeeAmount = Number(input.lateFeeAmount || 0);

  return {
    subtotal,
    taxable,
    taxAmount,
    withholdingAmount,
    lateFeeAmount,
    total: taxable + taxAmount - withholdingAmount + lateFeeAmount,
  };
}

export type InvoiceStatusInput = {
  current: string;
  total: number;
  amountPaid: number;
  /** Credit notes reduce what is still owed without money changing hands. */
  creditedAmount?: number;
  dueDate: Date;
  today: Date;
};

/** Derives the visible status. DRAFT and CANCELLED are set by hand only. */
export function deriveInvoiceStatus(input: InvoiceStatusInput): string {
  if (input.current === "DRAFT" || input.current === "CANCELLED") {
    return input.current;
  }
  const settled = input.amountPaid + (input.creditedAmount ?? 0);
  if (input.total > 0 && settled >= input.total) return "PAID";
  if (settled > 0) return "PARTIAL";
  if (input.dueDate < input.today) return "OVERDUE";
  return "SENT";
}

type Numeric = number | string | { toString(): string };

/** What the client still owes: total less payments and any credit notes. */
export function invoiceBalance(input: {
  total: Numeric;
  amountPaid: Numeric;
  creditedAmount?: Numeric;
}) {
  return (
    Number(input.total ?? 0) -
    Number(input.amountPaid ?? 0) -
    Number(input.creditedAmount ?? 0)
  );
}

/**
 * Late fee accrued on an overdue invoice, charged per started month past the
 * grace period. Returns 0 while the invoice is inside its grace window.
 */
export function computeLateFee(input: {
  outstanding: number;
  dueDate: Date;
  today: Date;
  percentPerMonth: number;
  graceDays: number;
}) {
  if (input.outstanding <= 0 || input.percentPerMonth <= 0) return 0;

  const daysLate = Math.floor(
    (input.today.getTime() - input.dueDate.getTime()) / 86_400_000,
  );
  const chargeableDays = daysLate - Math.max(input.graceDays, 0);
  if (chargeableDays <= 0) return 0;

  const months = Math.ceil(chargeableDays / 30);
  return (input.outstanding * input.percentPerMonth * months) / 100;
}
