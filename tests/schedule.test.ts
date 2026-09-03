import { describe, expect, it } from "vitest";
import { advanceDate, dueRunDates } from "@/lib/schedule";

describe("advanceDate", () => {
  const start = new Date("2026-01-31T00:00:00Z");

  it("clamps to the end of a shorter month", () => {
    expect(advanceDate(start, "MONTHLY", 1).toISOString().slice(0, 10)).toBe(
      "2026-02-28",
    );
  });

  it("moves by quarters and years", () => {
    expect(
      advanceDate(new Date("2026-01-15T00:00:00Z"), "QUARTERLY", 1)
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-04-15");
    expect(
      advanceDate(new Date("2026-01-15T00:00:00Z"), "YEARLY", 1)
        .toISOString()
        .slice(0, 10),
    ).toBe("2027-01-15");
  });

  it("treats a zero or negative interval as one period", () => {
    expect(
      advanceDate(new Date("2026-01-15T00:00:00Z"), "MONTHLY", 0)
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-02-15");
  });
});

describe("dueRunDates", () => {
  it("returns nothing when the next run is still ahead", () => {
    const result = dueRunDates(
      new Date("2026-10-01T00:00:00Z"),
      new Date("2026-09-15T00:00:00Z"),
      "MONTHLY",
      1,
      null,
    );
    expect(result.runs).toHaveLength(0);
    expect(result.nextRunAt.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("catches up on every period missed while the server was down", () => {
    const result = dueRunDates(
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-09-15T00:00:00Z"),
      "MONTHLY",
      1,
      null,
    );
    expect(result.runs.map((date) => date.toISOString().slice(0, 10))).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
    ]);
    expect(result.nextRunAt.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("stops at the end date", () => {
    const result = dueRunDates(
      new Date("2026-06-01T00:00:00Z"),
      new Date("2026-09-15T00:00:00Z"),
      "MONTHLY",
      1,
      new Date("2026-07-15T00:00:00Z"),
    );
    expect(result.runs.map((date) => date.toISOString().slice(0, 10))).toEqual([
      "2026-06-01",
      "2026-07-01",
    ]);
  });

  it("refuses to spin forever on a very old schedule", () => {
    const result = dueRunDates(
      new Date("2000-01-01T00:00:00Z"),
      new Date("2026-09-15T00:00:00Z"),
      "MONTHLY",
      1,
      null,
    );
    expect(result.runs).toHaveLength(24);
  });
});
