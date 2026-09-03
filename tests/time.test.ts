import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calendarDaysBetween,
  parseDateInput,
  startOfDaysFromToday,
  startOfToday,
} from "@/lib/time";

/**
 * The server is assumed to run in UTC (Vercel does). These tests pin the clock
 * to moments where a UTC-based implementation would report the wrong day in
 * Jakarta, which is the bug this module exists to prevent.
 */
describe("startOfToday in Asia/Jakarta", () => {
  beforeEach(() => {
    process.env.APP_TIMEZONE = "Asia/Jakarta";
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the Jakarta day, not the UTC day, just after local midnight", () => {
    // 2026-09-15 18:30 UTC is already 2026-09-16 01:30 in Jakarta.
    vi.setSystemTime(new Date("2026-09-15T18:30:00Z"));
    expect(startOfToday().toISOString()).toBe("2026-09-15T17:00:00.000Z");
  });

  it("still reports the same day late in the Jakarta evening", () => {
    // 2026-09-16 15:00 UTC is 22:00 on the 16th in Jakarta.
    vi.setSystemTime(new Date("2026-09-16T15:00:00Z"));
    expect(startOfToday().toISOString()).toBe("2026-09-15T17:00:00.000Z");
  });

  it("advances by whole calendar days", () => {
    vi.setSystemTime(new Date("2026-09-15T18:30:00Z"));
    expect(startOfDaysFromToday(3).toISOString()).toBe(
      "2026-09-18T17:00:00.000Z",
    );
  });
});

describe("parseDateInput", () => {
  beforeEach(() => {
    process.env.APP_TIMEZONE = "Asia/Jakarta";
  });

  it("reads a date field as midnight in Jakarta", () => {
    expect(parseDateInput("2026-09-15")!.toISOString()).toBe(
      "2026-09-14T17:00:00.000Z",
    );
  });

  it("returns null for empty input", () => {
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput(null)).toBeNull();
  });
});

describe("calendarDaysBetween", () => {
  beforeEach(() => {
    process.env.APP_TIMEZONE = "Asia/Jakarta";
  });

  it("counts whole days regardless of time of day", () => {
    const due = new Date("2026-09-01T17:00:00Z"); // 2 Sep 00:00 WIB
    const today = new Date("2026-09-11T17:00:00Z"); // 12 Sep 00:00 WIB
    expect(calendarDaysBetween(due, today)).toBe(10);
  });

  it("returns zero on the same Jakarta day", () => {
    expect(
      calendarDaysBetween(
        new Date("2026-09-01T18:00:00Z"),
        new Date("2026-09-02T10:00:00Z"),
      ),
    ).toBe(0);
  });
});
