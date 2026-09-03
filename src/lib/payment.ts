import { createHash } from "node:crypto";
import { reportError } from "@/lib/observability";

export function isPaymentGatewayConfigured() {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

function snapBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

function authHeader() {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

export type PaymentLinkInput = {
  orderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail?: string | null;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
};

/**
 * Creates a Midtrans Snap payment page. Midtrans only settles IDR and requires
 * whole-rupiah amounts, so non-IDR invoices are rejected up front.
 */
export async function createPaymentLink(input: PaymentLinkInput) {
  if (!isPaymentGatewayConfigured()) {
    return { ok: false as const, error: "MIDTRANS_SERVER_KEY belum diisi" };
  }
  if (input.currency !== "IDR") {
    return {
      ok: false as const,
      error: "Payment link Midtrans hanya mendukung invoice dalam IDR",
    };
  }

  const gross = Math.round(input.amount);
  if (gross <= 0) {
    return { ok: false as const, error: "Sisa tagihan sudah nol" };
  }

  // Midtrans rejects the request unless item prices sum exactly to gross_amount.
  const items = input.items.map((item) => ({
    id: item.id.slice(0, 50),
    name: item.name.slice(0, 50),
    price: Math.round(item.price),
    quantity: Math.round(item.quantity) || 1,
  }));
  const itemsTotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  if (itemsTotal !== gross) {
    items.length = 0;
    items.push({ id: "total", name: "Pembayaran invoice", price: gross, quantity: 1 });
  }

  try {
    const response = await fetch(snapBaseUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authHeader(),
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: gross },
        item_details: items,
        customer_details: {
          first_name: input.customerName.slice(0, 50),
          email: input.customerEmail ?? undefined,
        },
      }),
    });

    const payload = (await response.json()) as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
    };

    if (!response.ok || !payload.redirect_url) {
      return {
        ok: false as const,
        error: payload.error_messages?.join(", ") ?? "Gagal membuat payment link",
      };
    }

    return { ok: true as const, url: payload.redirect_url };
  } catch (error) {
    await reportError(error, { orderId: input.orderId });
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  settlement_time?: string;
};

/** Midtrans signs notifications with sha512(order_id + status_code + gross_amount + serverKey). */
export function verifyNotificationSignature(body: MidtransNotification) {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  const expected = createHash("sha512")
    .update(`${body.order_id}${body.status_code}${body.gross_amount}${key}`)
    .digest("hex");
  return expected === body.signature_key;
}

/** True only for notifications that mean money actually arrived. */
export function isPaidNotification(body: MidtransNotification) {
  if (body.transaction_status === "settlement") return true;
  return body.transaction_status === "capture" && body.fraud_status === "accept";
}
