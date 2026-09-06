import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVOICE_TEMPLATE,
  normalizeWhatsappNumber,
  renderTemplate,
  whatsappLink,
} from "@/lib/whatsapp";

describe("normalizeWhatsappNumber", () => {
  it("treats the local and international forms as the same number", () => {
    const expected = "628111111111";
    expect(normalizeWhatsappNumber("08111111111")).toBe(expected);
    expect(normalizeWhatsappNumber("+62 811-1111-111")).toBe(expected);
    expect(normalizeWhatsappNumber("62 811 1111 111")).toBe(expected);
    expect(normalizeWhatsappNumber("0062-811-1111-111")).toBe(expected);
    expect(normalizeWhatsappNumber("(0811) 1111 111")).toBe(expected);
  });

  it("adds the country code to a bare local number", () => {
    expect(normalizeWhatsappNumber("8111111111")).toBe("628111111111");
  });

  it("rejects values that cannot be a phone number", () => {
    expect(normalizeWhatsappNumber(null)).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber("-")).toBeNull();
    expect(normalizeWhatsappNumber("021 555")).toBeNull();
    expect(normalizeWhatsappNumber("6281111111111111111")).toBeNull();
  });

  it("honours a different country code", () => {
    expect(normalizeWhatsappNumber("012 3456 7890", "44")).toBe("441234567890");
  });
});

describe("whatsappLink", () => {
  it("escapes the message so newlines survive", () => {
    const link = whatsappLink("628111111111", "Halo\nDunia & rekan");
    expect(link).toContain("https://wa.me/628111111111?text=");
    expect(link).toContain("%0A");
    expect(link).toContain("%26");
  });
});

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(
      renderTemplate("Halo {klien}, tagihan {nomor}", {
        klien: "Rani",
        nomor: "INV/1",
      }),
    ).toBe("Halo Rani, tagihan INV/1");
  });

  it("leaves an unknown placeholder visible instead of blanking it", () => {
    expect(renderTemplate("Halo {salah_ketik}", { klien: "Rani" })).toBe(
      "Halo {salah_ketik}",
    );
  });

  it("drops a line that existed only for an empty value", () => {
    const result = renderTemplate(
      "Halo {klien}\n{tautan_bayar}\nTerima kasih",
      { klien: "Rani", tautan_bayar: "" },
    );
    expect(result).toBe("Halo Rani\nTerima kasih");
  });

  it("keeps a line that has text alongside an empty placeholder", () => {
    expect(
      renderTemplate("Sisa: {sisa} rupiah", { sisa: "" }),
    ).toBe("Sisa:  rupiah");
  });

  it("collapses the gap left behind by removed lines", () => {
    const result = renderTemplate(DEFAULT_INVOICE_TEMPLATE, {
      klien: "Rani",
      nomor: "INV/2026/0003",
      total: "Rp 8.175.000",
      jatuh_tempo: "15 Sep 2026",
      tautan_bayar: "",
      perusahaan: "Studio Kreatif",
    });

    expect(result).not.toContain("{");
    expect(result).not.toMatch(/\n{3,}/);
    expect(result).toContain("INV/2026/0003");
  });
});
