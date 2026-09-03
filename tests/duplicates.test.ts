import { describe, expect, it } from "vitest";
import {
  findDuplicateGroups,
  normalizeName,
  normalizePhone,
} from "@/lib/duplicates";

const base = { createdAt: new Date("2026-01-01T00:00:00Z") };

describe("normalizeName", () => {
  it("ignores legal form, case, and punctuation", () => {
    expect(normalizeName("PT. Maju Jaya")).toBe(normalizeName("pt maju jaya"));
    expect(normalizeName("CV Maju Jaya")).toBe(normalizeName("Maju  Jaya"));
  });
});

describe("normalizePhone", () => {
  it("treats +62 and 0 prefixes as the same number", () => {
    expect(normalizePhone("+62 811-1111")).toBe(normalizePhone("0811 1111"));
  });
});

describe("findDuplicateGroups", () => {
  it("groups clients sharing an email", () => {
    const groups = findDuplicateGroups([
      { id: "1", name: "Acme", company: null, email: "a@x.id", phone: null, ...base },
      { id: "2", name: "Acme Digital", company: null, email: "A@X.id", phone: null, ...base },
    ]);
    expect(groups.some((group) => group.reason === "Email sama")).toBe(true);
  });

  it("groups clients whose names normalize the same", () => {
    const groups = findDuplicateGroups([
      { id: "1", name: "PT Maju Jaya", company: null, email: null, phone: null, ...base },
      { id: "2", name: "cv maju jaya", company: null, email: null, phone: null, ...base },
    ]);
    expect(groups.some((group) => group.reason === "Nama mirip")).toBe(true);
  });

  it("leaves genuinely different clients alone", () => {
    const groups = findDuplicateGroups([
      { id: "1", name: "Acme", company: null, email: "a@x.id", phone: "0811", ...base },
      { id: "2", name: "Berkah", company: null, email: "b@y.id", phone: "0822", ...base },
    ]);
    expect(groups).toHaveLength(0);
  });

  it("ignores short phone fragments that would match everything", () => {
    const groups = findDuplicateGroups([
      { id: "1", name: "Satu", company: null, email: null, phone: "123", ...base },
      { id: "2", name: "Dua", company: null, email: null, phone: "123", ...base },
    ]);
    expect(groups).toHaveLength(0);
  });
});
