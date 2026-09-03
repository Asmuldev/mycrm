import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("escapes embedded quotes", () => {
    expect(csvCell('PT "Maju" Jaya')).toBe('"PT ""Maju"" Jaya"');
  });

  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("\"'=SUM(A1:A9)\"");
    expect(csvCell("+62811222333")).toBe("\"'+62811222333\"");
    expect(csvCell("-5")).toBe("\"'-5\"");
    expect(csvCell("@risky")).toBe("\"'@risky\"");
  });

  it("renders null and undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("writes a BOM so Excel reads UTF-8", () => {
    const csv = toCsv(["Nama"], [["Café"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Café"');
  });
});

describe("parseCsv", () => {
  it("handles quoted fields containing commas and newlines", () => {
    const rows = parseCsv('Nama,Alamat\n"PT A","Jl. Satu, No. 2\nBandung"\n');
    expect(rows).toEqual([
      ["Nama", "Alamat"],
      ["PT A", "Jl. Satu, No. 2\nBandung"],
    ]);
  });

  it("accepts semicolon separators and strips a BOM", () => {
    const rows = parseCsv("﻿Nama;Kota\nPT A;Jakarta\n");
    expect(rows).toEqual([
      ["Nama", "Kota"],
      ["PT A", "Jakarta"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("Nama\n\nPT A\n\n")).toEqual([["Nama"], ["PT A"]]);
  });

  it("survives a file with no trailing newline", () => {
    expect(parseCsv("Nama,Kota\nPT A,Jakarta")).toEqual([
      ["Nama", "Kota"],
      ["PT A", "Jakarta"],
    ]);
  });
});
