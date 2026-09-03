import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isPaidNotification,
  verifyNotificationSignature,
  type MidtransNotification,
} from "@/lib/payment";

const SERVER_KEY = "SB-Mid-server-testkey";

function sign(body: Omit<MidtransNotification, "signature_key">) {
  return createHash("sha512")
    .update(
      `${body.order_id}${body.status_code}${body.gross_amount}${SERVER_KEY}`,
    )
    .digest("hex");
}

function notification(
  overrides: Partial<MidtransNotification> = {},
): MidtransNotification {
  const base = {
    order_id: "INV-2026-0001-abc",
    status_code: "200",
    gross_amount: "8325000.00",
    transaction_status: "settlement",
  };
  return { ...base, signature_key: sign(base), ...overrides };
}

describe("verifyNotificationSignature", () => {
  beforeEach(() => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
  });
  afterEach(() => {
    delete process.env.MIDTRANS_SERVER_KEY;
  });

  it("accepts a correctly signed notification", () => {
    expect(verifyNotificationSignature(notification())).toBe(true);
  });

  it("rejects a forged signature", () => {
    expect(
      verifyNotificationSignature(notification({ signature_key: "deadbeef" })),
    ).toBe(false);
  });

  it("rejects a tampered amount", () => {
    // Signature was computed for the original amount, so raising it must fail.
    expect(
      verifyNotificationSignature(notification({ gross_amount: "1.00" })),
    ).toBe(false);
  });

  it("rejects everything when the server key is missing", () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    expect(verifyNotificationSignature(notification())).toBe(false);
  });
});

describe("isPaidNotification", () => {
  it("treats settlement as paid", () => {
    expect(isPaidNotification(notification())).toBe(true);
  });

  it("accepts a captured card only when fraud review passed", () => {
    expect(
      isPaidNotification(
        notification({ transaction_status: "capture", fraud_status: "accept" }),
      ),
    ).toBe(true);
    expect(
      isPaidNotification(
        notification({ transaction_status: "capture", fraud_status: "challenge" }),
      ),
    ).toBe(false);
  });

  it("ignores pending, denied, and expired notifications", () => {
    for (const status of ["pending", "deny", "expire", "cancel"]) {
      expect(
        isPaidNotification(notification({ transaction_status: status })),
      ).toBe(false);
    }
  });
});
