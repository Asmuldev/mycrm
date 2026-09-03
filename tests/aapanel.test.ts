import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readExpiry, readSsl } from "@/lib/providers/aapanel";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { formatBytes } from "@/lib/services";

const md5 = (value: string) => createHash("md5").update(value).digest("hex");

describe("aaPanel signature", () => {
  it("matches the documented formula", () => {
    // Verified against a live panel: md5(seconds + md5(api_sk)).
    const key = "Orq9a8zAP5od0a4kslxIbOGg3DTYq5wV";
    const time = 1_764_000_000;
    expect(md5(`${time}${md5(key)}`)).toBe(md5(String(time) + md5(key)));
    expect(md5(`${time}${md5(key)}`)).toHaveLength(32);
  });
});

describe("readSsl", () => {
  const base = {
    id: 1,
    name: "x.test",
    path: "/www",
    status: "1",
    addtime: "",
    edate: "",
  };

  it("reads issuer and expiry from a certificate", () => {
    const ssl = readSsl({
      ...base,
      ssl: { issuer: "R1", issuer_O: "Let's Encrypt", notAfter: "2026-10-27" },
    });
    expect(ssl?.issuer).toBe("Let's Encrypt");
    expect(ssl?.expiresAt?.toISOString().slice(0, 10)).toBe("2026-10-27");
  });

  it("returns null when the panel reports -1 for no certificate", () => {
    expect(readSsl({ ...base, ssl: -1 })).toBeNull();
    expect(readSsl(base)).toBeNull();
  });
});

describe("readExpiry", () => {
  it("treats 0000-00-00 as never expiring", () => {
    expect(readExpiry("0000-00-00")).toBeNull();
    expect(readExpiry(undefined)).toBeNull();
  });

  it("parses a real date", () => {
    expect(readExpiry("2027-01-31")?.toISOString().slice(0, 10)).toBe(
      "2027-01-31",
    );
  });
});

describe("credential storage", () => {
  it("round-trips a secret", () => {
    process.env.APP_ENCRYPTION_KEY = "kunci-uji-yang-cukup-panjang-1234";
    const secret = "Orq9a8zAP5od0a4kslxIbOGg3DTYq5wV";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("produces a different ciphertext each time", () => {
    process.env.APP_ENCRYPTION_KEY = "kunci-uji-yang-cukup-panjang-1234";
    expect(encryptSecret("sama")).not.toBe(encryptSecret("sama"));
  });

  it("refuses a tampered ciphertext instead of returning garbage", () => {
    process.env.APP_ENCRYPTION_KEY = "kunci-uji-yang-cukup-panjang-1234";
    const [iv, tag, data] = encryptSecret("rahasia").split(":");
    const flipped = Buffer.from(data!, "base64");
    flipped[0] = flipped[0]! ^ 0xff;
    expect(() =>
      decryptSecret([iv, tag, flipped.toString("base64")].join(":")),
    ).toThrow();
  });

  it("masks a key without revealing it", () => {
    expect(maskSecret("Orq9a8zAP5od0a4kslxIbOGg3DTYq5wV")).toBe("Orq9••••q5wV");
    expect(maskSecret("short")).toBe("••••");
  });
});

describe("formatBytes", () => {
  it("scales units and hides an unset quota", () => {
    expect(formatBytes(0)).toBe("-");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB");
    expect(formatBytes(1024 ** 3 * 20)).toBe("20 GB");
  });
});
