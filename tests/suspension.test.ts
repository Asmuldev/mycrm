import { describe, expect, it } from "vitest";
import { invoiceBalance } from "@/lib/money";

/**
 * The suspension engine itself talks to the database and a live panel, so these
 * cover the decision rules it depends on rather than the I/O around them.
 */
describe("aturan penangguhan", () => {
  const overdue = (balanceDue: number) => ({
    total: 1_000_000,
    amountPaid: 1_000_000 - balanceDue,
    creditedAmount: 0,
  });

  it("menganggap invoice lunas tidak lagi menunggak", () => {
    expect(invoiceBalance(overdue(0))).toBe(0);
  });

  it("menghitung sisa setelah pembayaran sebagian", () => {
    expect(invoiceBalance(overdue(250_000))).toBe(250_000);
  });

  it("memperlakukan nota kredit seperti pembayaran", () => {
    expect(
      invoiceBalance({
        total: 1_000_000,
        amountPaid: 400_000,
        creditedAmount: 600_000,
      }),
    ).toBe(0);
  });

  it("tidak menganggap kelebihan bayar sebagai tunggakan", () => {
    expect(
      invoiceBalance({ total: 1_000_000, amountPaid: 1_200_000 }),
    ).toBeLessThan(0);
  });
});

describe("hari menunggak", () => {
  const daysOverdue = (dueDate: Date, today: Date) =>
    Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);

  it("nol pada hari jatuh tempo", () => {
    expect(
      daysOverdue(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-01T00:00:00Z")),
    ).toBe(0);
  });

  it("menghitung penuh setelah lewat", () => {
    expect(
      daysOverdue(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-09T00:00:00Z")),
    ).toBe(8);
  });
});
