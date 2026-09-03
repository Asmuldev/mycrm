import { describe, expect, it } from "vitest";
import {
  computeInvoiceTotals,
  computeLateFee,
  deriveInvoiceStatus,
  invoiceBalance,
  toBaseAmount,
} from "@/lib/money";

describe("computeInvoiceTotals", () => {
  it("adds VAT on the discounted base", () => {
    const totals = computeInvoiceTotals({
      items: [
        { quantity: 1, unitPrice: 25_000_000 },
        { quantity: 3, unitPrice: 5_000_000 },
      ],
      discount: 5_000_000,
      taxRate: 11,
    });

    expect(totals.subtotal).toBe(40_000_000);
    expect(totals.taxable).toBe(35_000_000);
    expect(totals.taxAmount).toBe(3_850_000);
    expect(totals.total).toBe(38_850_000);
  });

  it("subtracts PPh 23 because the client withholds it", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 10_000_000 }],
      discount: 0,
      taxRate: 11,
      withholdingRate: 2,
    });

    expect(totals.taxAmount).toBe(1_100_000);
    expect(totals.withholdingAmount).toBe(200_000);
    expect(totals.total).toBe(10_900_000);
  });

  it("never lets a discount larger than the subtotal go negative", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 1_000_000 }],
      discount: 5_000_000,
      taxRate: 11,
    });

    expect(totals.taxable).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("treats an empty invoice as zero rather than NaN", () => {
    const totals = computeInvoiceTotals({ items: [], discount: 0, taxRate: 11 });
    expect(totals.total).toBe(0);
  });
});

describe("deriveInvoiceStatus", () => {
  const dueDate = new Date("2026-09-10T00:00:00Z");
  const today = new Date("2026-09-15T00:00:00Z");

  it("keeps manual states untouched", () => {
    for (const current of ["DRAFT", "CANCELLED"]) {
      expect(
        deriveInvoiceStatus({
          current,
          total: 100,
          amountPaid: 100,
          dueDate,
          today,
        }),
      ).toBe(current);
    }
  });

  it("marks fully paid invoices PAID even past the due date", () => {
    expect(
      deriveInvoiceStatus({
        current: "OVERDUE",
        total: 100,
        amountPaid: 100,
        dueDate,
        today,
      }),
    ).toBe("PAID");
  });

  it("prefers PARTIAL over OVERDUE once money arrives", () => {
    expect(
      deriveInvoiceStatus({
        current: "SENT",
        total: 100,
        amountPaid: 40,
        dueDate,
        today,
      }),
    ).toBe("PARTIAL");
  });

  it("flags unpaid past-due invoices as OVERDUE", () => {
    expect(
      deriveInvoiceStatus({
        current: "SENT",
        total: 100,
        amountPaid: 0,
        dueDate,
        today,
      }),
    ).toBe("OVERDUE");
  });

  it("does not call a zero-total invoice paid", () => {
    expect(
      deriveInvoiceStatus({
        current: "SENT",
        total: 0,
        amountPaid: 0,
        dueDate: new Date("2026-09-20T00:00:00Z"),
        today,
      }),
    ).toBe("SENT");
  });
});

describe("toBaseAmount", () => {
  it("converts with the stored rate", () => {
    expect(toBaseAmount(1_000, 16_500)).toBe(16_500_000);
  });

  it("falls back to 1 for a missing or invalid rate", () => {
    expect(toBaseAmount(1_000, 0)).toBe(1_000);
    expect(toBaseAmount(1_000, "abc")).toBe(1_000);
    expect(toBaseAmount(1_000, null as never)).toBe(1_000);
  });
});

describe("credit notes and late fees", () => {
  it("subtracts credit notes from the outstanding balance", () => {
    expect(
      invoiceBalance({ total: 10_000, amountPaid: 2_000, creditedAmount: 3_000 }),
    ).toBe(5_000);
  });

  it("counts a credit note towards settling the invoice", () => {
    expect(
      deriveInvoiceStatus({
        current: "SENT",
        total: 10_000,
        amountPaid: 4_000,
        creditedAmount: 6_000,
        dueDate: new Date("2026-01-01T00:00:00Z"),
        today: new Date("2026-02-01T00:00:00Z"),
      }),
    ).toBe("PAID");
  });

  it("adds the late fee on top of tax", () => {
    const totals = computeInvoiceTotals({
      items: [{ quantity: 1, unitPrice: 1_000_000 }],
      discount: 0,
      taxRate: 11,
      lateFeeAmount: 50_000,
    });
    expect(totals.total).toBe(1_160_000);
  });
});

describe("computeLateFee", () => {
  const dueDate = new Date("2026-01-01T00:00:00Z");

  it("charges nothing inside the grace period", () => {
    expect(
      computeLateFee({
        outstanding: 1_000_000,
        dueDate,
        today: new Date("2026-01-05T00:00:00Z"),
        percentPerMonth: 2,
        graceDays: 7,
      }),
    ).toBe(0);
  });

  it("charges one month as soon as the grace period passes", () => {
    expect(
      computeLateFee({
        outstanding: 1_000_000,
        dueDate,
        today: new Date("2026-01-10T00:00:00Z"),
        percentPerMonth: 2,
        graceDays: 7,
      }),
    ).toBe(20_000);
  });

  it("charges a second month once 30 chargeable days pass", () => {
    expect(
      computeLateFee({
        outstanding: 1_000_000,
        dueDate,
        today: new Date("2026-02-15T00:00:00Z"),
        percentPerMonth: 2,
        graceDays: 7,
      }),
    ).toBe(40_000);
  });

  it("charges nothing when the invoice is settled or the rate is zero", () => {
    expect(
      computeLateFee({
        outstanding: 0,
        dueDate,
        today: new Date("2026-03-01T00:00:00Z"),
        percentPerMonth: 2,
        graceDays: 7,
      }),
    ).toBe(0);
    expect(
      computeLateFee({
        outstanding: 1_000_000,
        dueDate,
        today: new Date("2026-03-01T00:00:00Z"),
        percentPerMonth: 0,
        graceDays: 7,
      }),
    ).toBe(0);
  });
});
