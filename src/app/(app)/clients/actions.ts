"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { dateField, formatDate, optionalString, toNumber } from "@/lib/format";
import { recalcInvoice } from "@/lib/invoice";
import { generatePortalToken, hashPortalToken } from "@/lib/portal";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { ActivityType, ClientStatus } from "@/generated/prisma/client";

function readClientForm(formData: FormData) {
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    name: String(formData.get("name") ?? "").trim(),
    company: optionalString(formData.get("company")),
    email: optionalString(formData.get("email")),
    phone: optionalString(formData.get("phone")),
    website: optionalString(formData.get("website")),
    taxId: optionalString(formData.get("taxId")),
    address: optionalString(formData.get("address")),
    city: optionalString(formData.get("city")),
    country: optionalString(formData.get("country")),
    status: (String(formData.get("status") ?? "LEAD") as ClientStatus),
    notes: optionalString(formData.get("notes")),
    tags,
  };
}

export async function createClient(formData: FormData) {
  const session = await requireSession();
  const data = readClientForm(formData);
  if (!data.name) throw new Error("Nama klien wajib diisi");

  const client = await prisma.client.create({
    data: { ...data, ownerId: session.userId },
  });
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: string, formData: FormData) {
  await requireSession();
  const data = readClientForm(formData);
  if (!data.name) throw new Error("Nama klien wajib diisi");

  await prisma.client.update({ where: { id }, data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

/**
 * Archives a client. Invoices, quotes, and projects stay untouched and remain
 * visible in their own lists, because they are financial records that outlive
 * the contact they belong to. The client is restorable from the trash page.
 */
export async function deleteClient(id: string): Promise<ActionResult> {
  const session = await requireAdmin();

  const client = await prisma.client.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit(session, {
    action: "client.delete",
    entity: "Client",
    entityId: id,
    summary: `Memindahkan klien ${client.name} ke sampah`,
  });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function createContact(clientId: string, formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nama kontak wajib diisi");

  const isPrimary = formData.get("isPrimary") === "on";
  if (isPrimary) {
    await prisma.contact.updateMany({
      where: { clientId },
      data: { isPrimary: false },
    });
  }

  await prisma.contact.create({
    data: {
      clientId,
      name,
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      position: optionalString(formData.get("position")),
      isPrimary,
    },
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteContact(clientId: string, contactId: string) {
  await requireSession();
  await prisma.contact.delete({ where: { id: contactId } });
  revalidatePath(`/clients/${clientId}`);
}

export async function createActivity(clientId: string, formData: FormData) {
  const session = await requireSession();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("Isi aktivitas wajib diisi");

  await prisma.activity.create({
    data: {
      clientId,
      userId: session.userId,
      type: String(formData.get("type") ?? "NOTE") as ActivityType,
      subject: optionalString(formData.get("subject")),
      content,
    },
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/dashboard");
}

export type ImportState = {
  error?: string;
  created?: number;
  updated?: number;
  skipped?: string[];
};

const HEADER_ALIASES: Record<string, string> = {
  nama: "name",
  name: "name",
  "nama klien": "name",
  perusahaan: "company",
  company: "company",
  email: "email",
  telepon: "phone",
  phone: "phone",
  hp: "phone",
  website: "website",
  npwp: "taxId",
  taxid: "taxId",
  alamat: "address",
  address: "address",
  kota: "city",
  city: "city",
  negara: "country",
  country: "country",
  status: "status",
  tag: "tags",
  tags: "tags",
  catatan: "notes",
  notes: "notes",
};

const VALID_STATUS = new Set(["LEAD", "ACTIVE", "INACTIVE"]);

/**
 * Imports clients from CSV. Rows with an email that already exists are updated
 * rather than duplicated; rows without a name are reported back as skipped.
 */
export async function importClients(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await requireSession();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file CSV dulu" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "Ukuran file maksimal 2 MB" };
  }

  const rows = parseCsv(await file.text());
  if (rows.length < 2) {
    return { error: "File harus punya baris header dan minimal satu data" };
  }

  const header = rows[0]!.map(
    (cell) => HEADER_ALIASES[cell.trim().toLowerCase()] ?? "",
  );
  if (!header.includes("name")) {
    return { error: 'Kolom "Nama" tidak ditemukan di header CSV' };
  }

  const skipped: string[] = [];
  let created = 0;
  let updated = 0;

  for (const [index, row] of rows.slice(1).entries()) {
    const record: Record<string, string> = {};
    header.forEach((key, column) => {
      if (key) record[key] = (row[column] ?? "").trim();
    });

    if (!record.name) {
      skipped.push(`Baris ${index + 2}: nama kosong`);
      continue;
    }

    const status = record.status?.toUpperCase();
    const data = {
      name: record.name,
      company: record.company || null,
      email: record.email || null,
      phone: record.phone || null,
      website: record.website || null,
      taxId: record.taxId || null,
      address: record.address || null,
      city: record.city || null,
      country: record.country || null,
      status: (status && VALID_STATUS.has(status) ? status : "LEAD") as ClientStatus,
      notes: record.notes || null,
      tags: record.tags
        ? record.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean)
        : [],
    };

    const existing = record.email
      ? await prisma.client.findFirst({ where: { email: record.email } })
      : null;

    if (existing) {
      await prisma.client.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.client.create({ data: { ...data, ownerId: session.userId } });
      created += 1;
    }
  }

  await recordAudit(session, {
    action: "client.import",
    entity: "Client",
    summary: `Impor CSV: ${created} baru, ${updated} diperbarui, ${skipped.length} dilewati`,
  });

  revalidatePath("/clients");
  return { created, updated, skipped };
}

/** Records money received before it is tied to any invoice (uang muka). */
export async function recordClientCredit(clientId: string, formData: FormData) {
  const session = await requireSession();
  const amount = toNumber(formData.get("amount"));
  if (amount <= 0) throw new Error("Nominal harus lebih dari 0");

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Klien tidak ditemukan");

  const rate = toNumber(formData.get("exchangeRate"), 1);
  await prisma.clientCredit.create({
    data: {
      clientId,
      amount: amount.toFixed(2),
      remaining: amount.toFixed(2),
      currency: String(formData.get("currency") ?? "IDR"),
      exchangeRate: (rate > 0 ? rate : 1).toFixed(6),
      receivedAt: dateField(formData.get("receivedAt")) ?? new Date(),
      method: String(formData.get("method") ?? "TRANSFER"),
      reference: optionalString(formData.get("reference")),
      note: optionalString(formData.get("note")),
    },
  });

  await recordAudit(session, {
    action: "client_credit.create",
    entity: "Client",
    entityId: clientId,
    summary: `Mencatat uang muka dari ${client.name}`,
  });

  revalidatePath(`/clients/${clientId}`);
}

/**
 * Applies part of an advance to an invoice. The application writes a normal
 * payment row so every balance calculation keeps working unchanged.
 */
export async function applyClientCredit(creditId: string, formData: FormData) {
  const session = await requireSession();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) throw new Error("Invoice wajib dipilih");

  const [credit, invoice] = await Promise.all([
    prisma.clientCredit.findUnique({ where: { id: creditId } }),
    prisma.invoice.findUnique({ where: { id: invoiceId } }),
  ]);
  if (!credit) throw new Error("Uang muka tidak ditemukan");
  if (!invoice) throw new Error("Invoice tidak ditemukan");
  if (invoice.clientId !== credit.clientId) {
    throw new Error("Invoice ini bukan milik klien yang sama");
  }
  if (invoice.currency !== credit.currency) {
    throw new Error("Mata uang uang muka dan invoice harus sama");
  }

  const outstanding =
    Number(invoice.total) -
    Number(invoice.amountPaid) -
    Number(invoice.creditedAmount);
  const requested = toNumber(formData.get("amount"), Number(credit.remaining));
  const amount = Math.min(requested, Number(credit.remaining), outstanding);

  if (amount <= 0) {
    throw new Error("Tidak ada nilai yang bisa dipakai untuk invoice ini");
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount: amount.toFixed(2),
      paidAt: new Date(),
      method: "ADVANCE",
      reference: credit.reference,
      note: `Pemakaian uang muka ${formatDate(credit.receivedAt)}`,
    },
  });

  await prisma.$transaction([
    prisma.creditApplication.create({
      data: {
        clientCreditId: creditId,
        invoiceId,
        paymentId: payment.id,
        amount: amount.toFixed(2),
      },
    }),
    prisma.clientCredit.update({
      where: { id: creditId },
      data: { remaining: (Number(credit.remaining) - amount).toFixed(2) },
    }),
  ]);

  await recalcInvoice(invoiceId);
  await recordAudit(session, {
    action: "client_credit.apply",
    entity: "Invoice",
    entityId: invoiceId,
    summary: `Memakai uang muka untuk ${invoice.number}`,
  });

  revalidatePath(`/clients/${credit.clientId}`);
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deleteClientCredit(
  creditId: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const credit = await prisma.clientCredit.findUnique({
    where: { id: creditId },
    include: { applications: true },
  });
  if (!credit) return { error: "Uang muka tidak ditemukan" };
  if (credit.applications.length > 0) {
    return {
      error: "Uang muka ini sudah dipakai di invoice. Hapus pembayarannya dulu.",
    };
  }

  await prisma.clientCredit.delete({ where: { id: creditId } });
  await recordAudit(session, {
    action: "client_credit.delete",
    entity: "Client",
    entityId: credit.clientId,
    summary: "Menghapus catatan uang muka",
  });
  revalidatePath(`/clients/${credit.clientId}`);
}

/**
 * Moves every record from `sourceId` onto `targetId`, then archives the source.
 * Nothing is deleted, so a wrong merge stays recoverable from the trash.
 */
export async function mergeClients(formData: FormData) {
  const session = await requireAdmin();
  const targetId = String(formData.get("targetId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");

  if (!targetId || !sourceId) throw new Error("Pilih klien asal dan tujuan");
  if (targetId === sourceId) throw new Error("Klien asal dan tujuan sama");

  const [target, source] = await Promise.all([
    prisma.client.findUnique({ where: { id: targetId } }),
    prisma.client.findUnique({ where: { id: sourceId } }),
  ]);
  if (!target || !source) throw new Error("Klien tidak ditemukan");

  const move = { clientId: targetId };
  await prisma.$transaction([
    prisma.contact.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.deal.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.quote.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.invoice.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.recurringInvoice.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.project.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.expense.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.task.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.activity.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.attachment.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.creditNote.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.clientCredit.updateMany({ where: { clientId: sourceId }, data: move }),
    prisma.client.update({
      where: { id: sourceId },
      data: {
        deletedAt: new Date(),
        notes: [source.notes, `Digabungkan ke ${target.name}`]
          .filter(Boolean)
          .join("\n"),
      },
    }),
  ]);

  await recordAudit(session, {
    action: "client.merge",
    entity: "Client",
    entityId: targetId,
    summary: `Menggabungkan "${source.name}" ke "${target.name}"`,
  });

  revalidatePath("/clients");
  revalidatePath("/clients/duplicates");
  redirect(`/clients/${targetId}`);
}

export type PortalLinkState = { error?: string; token?: string };

/**
 * Issues a portal link. The raw token is shown once here and never stored, so
 * a leaked database still does not hand out client portals.
 */
export async function createPortalLink(
  clientId: string,
  _prev: PortalLinkState,
  formData: FormData,
): Promise<PortalLinkState> {
  const session = await requireSession();
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { error: "Klien tidak ditemukan" };

  const days = toNumber(formData.get("expiresInDays"), 0);
  const token = generatePortalToken();

  await prisma.portalToken.create({
    data: {
      clientId,
      tokenHash: hashPortalToken(token),
      label: optionalString(formData.get("label")) ?? "Portal klien",
      expiresAt:
        days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null,
    },
  });

  await recordAudit(session, {
    action: "portal.create",
    entity: "Client",
    entityId: clientId,
    summary: `Membuat tautan portal untuk ${client.name}`,
  });

  revalidatePath(`/clients/${clientId}`);
  return { token };
}

export async function revokePortalLink(clientId: string, tokenId: string) {
  const session = await requireSession();
  await prisma.portalToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
  await recordAudit(session, {
    action: "portal.revoke",
    entity: "Client",
    entityId: clientId,
    summary: "Mencabut tautan portal klien",
  });
  revalidatePath(`/clients/${clientId}`);
}
