"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import {
  createClientSessionCookie,
  destroyClientSessionCookie,
  getClientSession,
} from "@/lib/client-session";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { resolvePortalToken } from "@/lib/portal";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getClientIp,
  recordLoginAttempt,
} from "@/lib/rate-limit";

export type PortalLoginState = { error?: string };

export async function clientLogin(
  _prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email dan password wajib diisi" };

  const ip = await getClientIp();
  const limit = await checkLoginRateLimit(email, ip);
  if (limit.blocked) return { error: limit.message };

  const user = await prisma.clientUser.findUnique({
    where: { email },
    include: { client: { select: { deletedAt: true } } },
  });

  const valid = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  // One message for every failure, so the form cannot be used to discover
  // which email addresses exist.
  if (!user || !valid || !user.active || user.client.deletedAt) {
    await recordLoginAttempt(email, ip, false);
    return { error: "Email atau password salah" };
  }

  await recordLoginAttempt(email, ip, true);
  await clearLoginFailures(email);
  await prisma.clientUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await createClientSessionCookie({
    kind: "client",
    clientUserId: user.id,
    clientId: user.clientId,
    email: user.email,
    name: user.name,
    sessionVersion: user.sessionVersion,
  });

  redirect("/portal/dashboard");
}

export async function clientLogout() {
  await destroyClientSessionCookie();
  redirect("/portal/login");
}

export type UploadProofState = { error?: string; success?: string };

const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

/**
 * Lets a client attach proof of payment to their own invoice.
 *
 * Access is resolved from whichever credential the visitor actually holds — a
 * portal link or a signed-in account — and the invoice is then checked against
 * that client. A token for one client cannot attach anything to another's.
 */
export async function uploadPaymentProof(
  invoiceId: string,
  token: string | null,
  _prev: UploadProofState,
  formData: FormData,
): Promise<UploadProofState> {
  let clientId: string | null = null;

  if (token) {
    const portal = await resolvePortalToken(token);
    clientId = portal?.clientId ?? null;
  } else {
    const session = await getClientSession();
    clientId = session?.clientId ?? null;
  }

  if (!clientId) return { error: "Sesi tidak valid. Muat ulang halaman." };

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, clientId: true, number: true, deletedAt: true },
  });
  if (!invoice || invoice.deletedAt || invoice.clientId !== clientId) {
    return { error: "Invoice tidak ditemukan" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih berkas bukti transfer dulu" };
  }
  if (file.size > PROOF_MAX_BYTES) {
    return { error: "Ukuran berkas maksimal 5 MB" };
  }
  if (!PROOF_TYPES.includes(file.type)) {
    return { error: "Berkas harus PDF, PNG, JPG, atau WEBP" };
  }

  await prisma.attachment.create({
    data: {
      filename: file.name.slice(0, 200),
      mimeType: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
      invoiceId: invoice.id,
      clientUploaded: true,
    },
  });

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  await recordAudit(null, {
    action: "invoice.proof_uploaded",
    entity: "Invoice",
    entityId: invoice.id,
    summary: `${client?.name ?? "Klien"} mengunggah bukti transfer untuk ${invoice.number}`,
  });

  await notify({
    kind: "payment_proof",
    title: `Bukti transfer masuk untuk ${invoice.number}`,
    body: client?.name ?? undefined,
    href: `/invoices/${invoice.id}`,
  });

  revalidatePath(`/invoices/${invoice.id}`);
  return { success: "Bukti transfer terkirim. Kami akan memeriksanya." };
}
