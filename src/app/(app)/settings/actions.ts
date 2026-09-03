"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { optionalString, toNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

export async function updateCompanyProfile(formData: FormData) {
  const session = await requireAdmin();

  const data = {
    name: String(formData.get("name") ?? "").trim() || "My Company",
    email: optionalString(formData.get("email")),
    phone: optionalString(formData.get("phone")),
    address: optionalString(formData.get("address")),
    taxId: optionalString(formData.get("taxId")),
    bankName: optionalString(formData.get("bankName")),
    bankAccount: optionalString(formData.get("bankAccount")),
    bankHolder: optionalString(formData.get("bankHolder")),
    invoicePrefix:
      String(formData.get("invoicePrefix") ?? "INV").trim().toUpperCase() || "INV",
    defaultTaxRate: toNumber(formData.get("defaultTaxRate")).toFixed(2),
    defaultTerms: optionalString(formData.get("defaultTerms")),
    currency: String(formData.get("currency") ?? "IDR"),
    accentColor: normalizeHexColor(formData.get("accentColor")),
    defaultWithholdingRate: toNumber(formData.get("defaultWithholdingRate")).toFixed(2),
    emailFromName: optionalString(formData.get("emailFromName")),
    emailReplyTo: optionalString(formData.get("emailReplyTo")),
    reminderEnabled: formData.get("reminderEnabled") === "on",
    reminderDaysBefore: Math.max(toNumber(formData.get("reminderDaysBefore"), 3), 0),
    reminderDaysAfter: Math.max(toNumber(formData.get("reminderDaysAfter"), 7), 0),
    autoSuspendEnabled: formData.get("autoSuspendEnabled") === "on",
    autoSuspendAfterDays: Math.max(
      toNumber(formData.get("autoSuspendAfterDays"), 7),
      0,
    ),
    autoResumeOnPayment: formData.get("autoResumeOnPayment") === "on",
    lateFeeEnabled: formData.get("lateFeeEnabled") === "on",
    lateFeePercent: Math.max(toNumber(formData.get("lateFeePercent")), 0).toFixed(2),
    lateFeeGraceDays: Math.max(toNumber(formData.get("lateFeeGraceDays"), 7), 0),
  };

  await prisma.companyProfile.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  await recordAudit(session, {
    action: "settings.update",
    entity: "CompanyProfile",
    entityId: "default",
    summary: "Memperbarui profil perusahaan",
  });

  revalidatePath("/settings");
  revalidatePath("/invoices");
}

const LOGO_MAX_BYTES = 512 * 1024;
// react-pdf embeds raster images only; SVG and WebP are not supported there.
const LOGO_TYPES = ["image/png", "image/jpeg"];

function normalizeHexColor(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : "#0f172a";
}

export type LogoState = { error?: string; success?: string };

/** Stores the logo inline as a data URI so it works on read-only filesystems. */
export async function uploadLogo(
  _prev: LogoState,
  formData: FormData,
): Promise<LogoState> {
  await requireAdmin();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pilih file logo dulu" };
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { error: "Format logo harus PNG atau JPG" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { error: "Ukuran logo maksimal 512 KB" };
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  await prisma.companyProfile.upsert({
    where: { id: "default" },
    update: { logoUrl: `data:${file.type};base64,${base64}` },
    create: { id: "default", logoUrl: `data:${file.type};base64,${base64}` },
  });

  revalidatePath("/settings");
  revalidatePath("/invoices");
  return { success: "Logo diperbarui" };
}

export async function removeLogo() {
  await requireAdmin();
  await prisma.companyProfile.update({
    where: { id: "default" },
    data: { logoUrl: null },
  });
  revalidatePath("/settings");
  revalidatePath("/invoices");
}

export type AccountState = { error?: string; success?: string };

export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await requireSession();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8) return { error: "Password baru minimal 8 karakter" };
  if (next !== confirm) return { error: "Konfirmasi password tidak cocok" };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { error: "Akun tidak ditemukan" };

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) return { error: "Password lama salah" };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(next, 10),
      // Other devices signed in with the old password are logged out.
      sessionVersion: { increment: 1 },
    },
  });
  await recordAudit(session, {
    action: "password.change",
    entity: "User",
    entityId: user.id,
    summary: "Mengubah password sendiri",
  });

  return { success: "Password berhasil diubah" };
}

export type UserState = { error?: string; success?: string };

export async function createUser(
  _prev: UserState,
  formData: FormData,
): Promise<UserState> {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "MEMBER") as Role;

  if (name.length < 2) return { error: "Nama minimal 2 karakter" };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Email tidak valid" };
  if (password.length < 8) return { error: "Password minimal 8 karakter" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Email sudah terdaftar" };

  const user = await prisma.user.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
  });
  await recordAudit(session, {
    action: "user.create",
    entity: "User",
    entityId: user.id,
    summary: `Menambah pengguna ${email} sebagai ${role}`,
  });

  revalidatePath("/settings");
  return { success: `Pengguna ${email} dibuat` };
}

export async function setUserRole(userId: string, formData: FormData) {
  const session = await requireAdmin();
  const role = String(formData.get("role") ?? "MEMBER") as Role;

  if (userId === session.userId && role !== "ADMIN") {
    throw new Error("Tidak bisa menurunkan peran akun Anda sendiri");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role, sessionVersion: { increment: 1 } },
  });
  await recordAudit(session, {
    action: "user.role",
    entity: "User",
    entityId: userId,
    summary: `Mengubah peran ${user.email} menjadi ${role}`,
  });
  revalidatePath("/settings");
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (userId === session.userId) {
    return { error: "Tidak bisa menghapus akun Anda sendiri" };
  }

  const remainingAdmins = await prisma.user.count({
    where: { role: "ADMIN", id: { not: userId } },
  });
  if (remainingAdmins === 0) {
    return { error: "Harus ada minimal satu admin" };
  }

  const user = await prisma.user.delete({ where: { id: userId } });
  await recordAudit(session, {
    action: "user.delete",
    entity: "User",
    entityId: userId,
    summary: `Menghapus pengguna ${user.email}`,
  });
  revalidatePath("/settings");
}
