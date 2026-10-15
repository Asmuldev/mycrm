"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { dateField, optionalString, toNumber } from "@/lib/format";
import {
  getCompanyProfile,
  nextInvoiceNumber,
  recalcInvoice,
} from "@/lib/invoice";
import { sendInvoiceEmail } from "@/lib/invoice-mailer";
import { computeLateFee, invoiceBalance } from "@/lib/money";
import { createPaymentLink } from "@/lib/payment";
import { requireAdmin } from "@/lib/permissions";
import { resumeServicesForInvoice } from "@/lib/suspension";
import { prisma } from "@/lib/prisma";
import { startOfToday } from "@/lib/time";
import type { InvoiceStatus } from "@/generated/prisma/client";

type ItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: string;
  position: number;
};

function readItems(formData: FormData): ItemInput[] {
  const descriptions = formData.getAll("itemDescription");
  const quantities = formData.getAll("itemQuantity");
  const prices = formData.getAll("itemUnitPrice");

  return descriptions
    .map((description, index) => {
      const text = String(description ?? "").trim();
      const quantity = toNumber(quantities[index] ?? null, 0);
      const unitPrice = toNumber(prices[index] ?? null, 0);
      return {
        description: text,
        quantity,
        unitPrice,
        amount: (quantity * unitPrice).toFixed(2),
        position: index,
      };
    })
    .filter((item) => item.description.length > 0);
}

function readInvoiceForm(formData: FormData) {
  const rate = toNumber(formData.get("exchangeRate"), 1);

  return {
    clientId: String(formData.get("clientId") ?? ""),
    status: String(formData.get("status") ?? "DRAFT") as InvoiceStatus,
    issueDate: dateField(formData.get("issueDate")) ?? new Date(),
    dueDate: dateField(formData.get("dueDate")) ?? new Date(),
    currency: String(formData.get("currency") ?? "IDR"),
    exchangeRate: (rate > 0 ? rate : 1).toFixed(6),
    discount: toNumber(formData.get("discount")).toFixed(2),
    taxRate: toNumber(formData.get("taxRate")).toFixed(2),
    withholdingRate: toNumber(formData.get("withholdingRate")).toFixed(2),
    notes: optionalString(formData.get("notes")),
    terms: optionalString(formData.get("terms")),
  };
}

export async function createInvoice(formData: FormData) {
  await requireSession();
  const data = readInvoiceForm(formData);
  if (!data.clientId) throw new Error("Klien wajib dipilih");

  const items = readItems(formData);
  if (items.length === 0) throw new Error("Minimal satu item invoice");

  const invoice = await prisma.invoice.create({
    data: {
      ...data,
      number: await nextInvoiceNumber(),
      items: {
        create: items.map((item) => ({
          description: item.description,
          quantity: item.quantity.toFixed(2),
          unitPrice: item.unitPrice.toFixed(2),
          amount: item.amount,
          position: item.position,
        })),
      },
    },
  });

  await recalcInvoice(invoice.id);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoice(id: string, formData: FormData) {
  await requireSession();
  const data = readInvoiceForm(formData);
  const items = readItems(formData);
  if (items.length === 0) throw new Error("Minimal satu item invoice");

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: {
        ...data,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity.toFixed(2),
            unitPrice: item.unitPrice.toFixed(2),
            amount: item.amount,
            position: item.position,
          })),
        },
      },
    }),
  ]);

  await recalcInvoice(id);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function setInvoiceStatus(id: string, status: InvoiceStatus) {
  await requireSession();

  if (status === "PAID") {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        payments: true,
        creditNotes: { where: { status: "ISSUED", deletedAt: null } },
      },
    });
    if (invoice) {
      const balance = invoiceBalance(invoice);
      if (balance > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: id,
            amount: balance.toFixed(2),
            paidAt: new Date(),
            method: "TRANSFER",
            note: "Ditandai lunas manual",
          },
        });
        await resumeServicesForInvoice(id);
      }
    }
  }

  await prisma.invoice.update({ where: { id }, data: { status } });
  await recalcInvoice(id);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/dashboard");
}

export async function deleteInvoice(id: string) {
  const session = await requireAdmin();
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit(session, {
    action: "invoice.delete",
    entity: "Invoice",
    entityId: id,
    summary: `Memindahkan invoice ${invoice.number} ke sampah`,
  });
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function addPayment(invoiceId: string, formData: FormData) {
  await requireSession();
  const amount = toNumber(formData.get("amount"));
  if (amount <= 0) throw new Error("Nominal pembayaran harus lebih dari 0");

  await prisma.payment.create({
    data: {
      invoiceId,
      amount: amount.toFixed(2),
      paidAt: dateField(formData.get("paidAt")) ?? new Date(),
      method: String(formData.get("method") ?? "TRANSFER"),
      reference: optionalString(formData.get("reference")),
      note: optionalString(formData.get("note")),
    },
  });

  await recalcInvoice(invoiceId);
  // A payment that clears the account brings suspended services back.
  await resumeServicesForInvoice(invoiceId);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/services");
}

export async function deletePayment(invoiceId: string, paymentId: string) {
  await requireSession();
  await prisma.payment.delete({ where: { id: paymentId } });
  await recalcInvoice(invoiceId);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export type InvoiceActionState = { error?: string; success?: string };

/** Emails the invoice PDF to the client and flips DRAFT to SENT. */
export async function sendInvoice(
  invoiceId: string,
  _prev: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const session = await requireSession();
  const message = optionalString(formData.get("message"));

  const result = await sendInvoiceEmail(
    invoiceId,
    "invoice_sent",
    message ?? undefined,
  );

  if (!result.ok && !("skipped" in result)) {
    return { error: result.error ?? "Gagal mengirim email" };
  }

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      sentAt: new Date(),
      status: { set: "SENT" },
    },
  });
  await recalcInvoice(invoiceId);
  await recordAudit(session, {
    action: "invoice.send",
    entity: "Invoice",
    entityId: invoiceId,
    summary: `Mengirim invoice ${invoice.number} ke klien`,
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");

  if ("skipped" in result && result.skipped) {
    return {
      success:
        "Invoice ditandai terkirim, tapi email tidak dikirim karena RESEND_API_KEY belum diisi.",
    };
  }
  return { success: "Invoice terkirim ke email klien" };
}

/** Creates a Midtrans Snap link for the outstanding balance. */
export async function generatePaymentLink(invoiceId: string) {
  const session = await requireSession();
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, items: { orderBy: { position: "asc" } } },
  });
  if (!invoice) throw new Error("Invoice tidak ditemukan");

  const balance = invoiceBalance(invoice);
  const orderId = `${invoice.number.replace(/\//g, "-")}-${Date.now().toString(36)}`;

  const result = await createPaymentLink({
    orderId,
    amount: balance,
    currency: invoice.currency,
    customerName: invoice.client.name,
    customerEmail: invoice.client.email,
    items: invoice.items.map((item) => ({
      id: item.id,
      name: item.description,
      price: Number(item.unitPrice),
      quantity: Number(item.quantity),
    })),
  });

  if (!result.ok) throw new Error(result.error);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paymentLinkUrl: result.url, paymentRef: orderId },
  });
  await recordAudit(session, {
    action: "invoice.payment_link",
    entity: "Invoice",
    entityId: invoiceId,
    summary: `Membuat payment link untuk ${invoice.number}`,
  });

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function addSchedule(invoiceId: string, formData: FormData) {
  await requireSession();
  const amount = toNumber(formData.get("amount"));
  if (amount <= 0) throw new Error("Nominal termin harus lebih dari 0");

  const count = await prisma.invoiceSchedule.count({ where: { invoiceId } });

  await prisma.invoiceSchedule.create({
    data: {
      invoiceId,
      label: optionalString(formData.get("label")) ?? `Termin ${count + 1}`,
      amount: amount.toFixed(2),
      dueDate: dateField(formData.get("dueDate")) ?? new Date(),
      position: count,
    },
  });

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deleteSchedule(invoiceId: string, scheduleId: string) {
  await requireSession();
  await prisma.invoiceSchedule.delete({ where: { id: scheduleId } });
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function toggleSchedulePaid(
  invoiceId: string,
  scheduleId: string,
) {
  await requireSession();
  const schedule = await prisma.invoiceSchedule.findUnique({
    where: { id: scheduleId },
  });
  if (!schedule) return;

  await prisma.invoiceSchedule.update({
    where: { id: scheduleId },
    data: { paidAt: schedule.paidAt ? null : new Date() },
  });
  revalidatePath(`/invoices/${invoiceId}`);
}

/** Records the PPh 23 withholding slip the client hands back after paying. */
export async function saveWithholdingSlip(
  invoiceId: string,
  formData: FormData,
) {
  const session = await requireSession();
  const number = optionalString(formData.get("withholdingSlipNumber"));

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      withholdingSlipNumber: number,
      withholdingSlipDate: number
        ? (dateField(formData.get("withholdingSlipDate")) ?? new Date())
        : null,
    },
  });

  await recordAudit(session, {
    action: "invoice.withholding_slip",
    entity: "Invoice",
    entityId: invoiceId,
    summary: number
      ? `Mencatat bukti potong ${number} untuk ${invoice.number}`
      : `Menghapus catatan bukti potong ${invoice.number}`,
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/reports");
}

/**
 * Charges the late fee the settings define for this invoice's overdue period.
 * Applied explicitly rather than silently, because it changes what the client
 * owes after the invoice was already sent.
 */
export async function applyLateFee(invoiceId: string) {
  const session = await requireSession();
  const [invoice, profile] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoiceId } }),
    getCompanyProfile(),
  ]);
  if (!invoice) throw new Error("Invoice tidak ditemukan");
  if (!profile.lateFeeEnabled) throw new Error("Denda keterlambatan belum diaktifkan");

  const fee = computeLateFee({
    outstanding: invoiceBalance(invoice),
    dueDate: new Date(invoice.dueDate),
    today: startOfToday(),
    percentPerMonth: Number(profile.lateFeePercent),
    graceDays: profile.lateFeeGraceDays,
  });

  if (fee <= 0) throw new Error("Belum ada denda yang bisa dikenakan");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { lateFeeAmount: fee.toFixed(2) },
  });
  await recalcInvoice(invoiceId);
  await recordAudit(session, {
    action: "invoice.late_fee",
    entity: "Invoice",
    entityId: invoiceId,
    summary: `Mengenakan denda keterlambatan pada ${invoice.number}`,
  });

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function clearLateFee(invoiceId: string) {
  const session = await requireSession();
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { lateFeeAmount: "0" },
  });
  await recalcInvoice(invoiceId);
  await recordAudit(session, {
    action: "invoice.late_fee_clear",
    entity: "Invoice",
    entityId: invoiceId,
    summary: `Menghapus denda keterlambatan pada ${invoice.number}`,
  });
  revalidatePath(`/invoices/${invoiceId}`);
}

/** Applies a status change to many invoices at once from the list page. */
export async function bulkInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const ids = formData.getAll("invoiceId").map(String).filter(Boolean);
  const action = String(formData.get("bulkAction") ?? "");

  if (ids.length === 0) throw new Error("Pilih minimal satu invoice");

  if (action === "delete") {
    await requireAdmin();
    await prisma.invoice.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
  } else if (action === "sent" || action === "paid" || action === "cancelled") {
    const status = (
      action === "sent" ? "SENT" : action === "paid" ? "PAID" : "CANCELLED"
    ) as InvoiceStatus;

    if (status === "PAID") {
      for (const id of ids) {
        const invoice = await prisma.invoice.findUnique({
          where: { id },
          include: {
            payments: true,
            creditNotes: { where: { status: "ISSUED", deletedAt: null } },
          },
        });
        if (invoice) {
          const balance = invoiceBalance(invoice);
          if (balance > 0) {
            await prisma.payment.create({
              data: {
                invoiceId: id,
                amount: balance.toFixed(2),
                paidAt: new Date(),
                method: "TRANSFER",
                note: "Ditandai lunas manual (aksi massal)",
              },
            });
            await resumeServicesForInvoice(id);
          }
        }
      }
    }

    await prisma.invoice.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        ...(action === "sent" ? { sentAt: new Date() } : {}),
      },
    });
    // recalc rewrites derived statuses; PAID and CANCELLED are respected as-is.
    for (const id of ids) await recalcInvoice(id);
  } else {
    throw new Error("Aksi massal tidak dikenal");
  }

  await recordAudit(session, {
    action: "invoice.bulk",
    entity: "Invoice",
    summary: `Aksi massal "${action}" pada ${ids.length} invoice`,
  });

  revalidatePath("/invoices");
}
