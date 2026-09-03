import { describe, expect, it } from "vitest";
import {
  formatHours,
  parseDuration,
  projectProfit,
  unbilledTimeValue,
} from "@/lib/projects";

describe("parseDuration", () => {
  it("reads clock notation", () => {
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("0:45")).toBe(45);
  });

  it("reads decimal hours with a comma or a dot", () => {
    expect(parseDuration("1.5")).toBe(90);
    expect(parseDuration("1,5")).toBe(90);
    expect(parseDuration("2 jam")).toBe(120);
  });

  it("reads explicit minutes", () => {
    expect(parseDuration("90m")).toBe(90);
    expect(parseDuration("45 menit")).toBe(45);
  });

  it("rejects nonsense instead of guessing", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("kemarin")).toBeNull();
    expect(parseDuration("1:75")).toBeNull();
  });
});

describe("formatHours", () => {
  it("omits minutes when the hour is whole", () => {
    expect(formatHours(120)).toBe("2 jam");
    expect(formatHours(95)).toBe("1 jam 35 menit");
  });
});

describe("unbilledTimeValue", () => {
  const entries = [
    { minutes: 60, billable: true, hourlyRate: 500_000, invoiceId: null },
    { minutes: 120, billable: true, hourlyRate: 500_000, invoiceId: "inv1" },
    { minutes: 60, billable: false, hourlyRate: 500_000, invoiceId: null },
    { minutes: 30, billable: true, hourlyRate: 400_000, invoiceId: null },
  ];

  it("counts only billable time that has not been invoiced", () => {
    expect(unbilledTimeValue(entries)).toBe(700_000);
  });
});

describe("projectProfit", () => {
  it("converts costs to base currency before subtracting", () => {
    const result = projectProfit({
      invoicedBase: 100_000_000,
      expenses: [
        { amount: 20_000_000, exchangeRate: 1, billable: false },
        { amount: 1_000, exchangeRate: 16_500, billable: false },
      ],
    });

    expect(result.costBase).toBe(36_500_000);
    expect(result.margin).toBe(63_500_000);
    expect(Math.round(result.marginPercent)).toBe(64);
  });

  it("reports zero percent when nothing was invoiced", () => {
    const result = projectProfit({
      invoicedBase: 0,
      expenses: [{ amount: 500, exchangeRate: 1, billable: false }],
    });
    expect(result.margin).toBe(-500);
    expect(result.marginPercent).toBe(0);
  });
});
