import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { recalcInvoice } from "@/lib/invoice";
import {
  isPaidNotification,
  verifyNotificationSignature,
  type MidtransNotification,
} from "@/lib/payment";
import { notify } from "@/lib/notifications";
import { reportError } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: MidtransNotification;
  try {
    body = (await request.json()) as MidtransNotification;
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  if (!verifyNotificationSignature(body)) {
    await reportError(new Error("Signature webhook Midtrans tidak valid"), {
      orderId: body.order_id ?? null,
    });
    return NextResponse.json({ error: "Signature tidak valid" }, { status: 401 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { paymentRef: body.order_id },
  });
  if (!invoice) {
    // Acknowledge so Midtrans stops retrying a notification we cannot match.
    return NextResponse.json({ ok: true, matched: false });
  }

  if (!isPaidNotification(body)) {
    return NextResponse.json({ ok: true, status: body.transaction_status });
  }

  const reference = body.transaction_id ?? body.order_id;
  const existing = await prisma.payment.findFirst({
    where: { invoiceId: invoice.id, reference },
  });
  // Midtrans retries notifications, so the same transaction must not double-post.
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: Number(body.gross_amount).toFixed(2),
      paidAt: body.settlement_time ? new Date(body.settlement_time) : new Date(),
      method: (body.payment_type ?? "MIDTRANS").toUpperCase(),
      reference,
      note: "Pembayaran otomatis via Midtrans",
    },
  });

  await recalcInvoice(invoice.id);
  await notify({
    kind: "payment_received",
    title: `Pembayaran masuk untuk ${invoice.number}`,
    body: `Rp ${Number(body.gross_amount).toLocaleString("id-ID")} via ${body.payment_type ?? "Midtrans"}`,
    href: `/invoices/${invoice.id}`,
    dedupeKey: `payment:${reference}`,
  });
  await recordAudit(null, {
    action: "invoice.payment_webhook",
    entity: "Invoice",
    entityId: invoice.id,
    summary: `Pembayaran Midtrans ${body.gross_amount} untuk ${invoice.number}`,
  });

  return NextResponse.json({ ok: true });
}
