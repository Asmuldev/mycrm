"use server";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionCookie, destroySessionCookie } from "@/lib/auth";
import { emailShell, sendEmail } from "@/lib/email";
import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  getClientIp,
  recordLoginAttempt,
} from "@/lib/rate-limit";
import { recordAudit } from "@/lib/audit";

export type AuthState = { error?: string };

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await getClientIp();

  const limit = await checkLoginRateLimit(email, ip);
  if (limit.blocked) return { error: limit.message };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user
    ? await bcrypt.compare(parsed.data.password, user.passwordHash)
    : false;

  if (!user || !valid) {
    await recordLoginAttempt(email, ip, false);
    return { error: "Email atau password salah" };
  }

  await recordLoginAttempt(email, ip, true);
  await clearLoginFailures(email);
  await createSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  redirect("/dashboard");
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Email sudah terdaftar" };

  const userCount = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: userCount === 0 ? "ADMIN" : "MEMBER",
    },
  });

  await createSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}

const RESET_TTL_MINUTES = 60;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export type ResetState = { error?: string; success?: string };

/**
 * Always reports success so the form cannot be used to probe which emails exist.
 */
export async function requestPasswordReset(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Email wajib diisi" };

  const done = {
    success:
      "Jika email terdaftar, tautan atur ulang password sudah dikirim. Cek kotak masuk Anda.",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return done;

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
    },
  });

  const profile = await getCompanyProfile();
  const url = `${appUrl()}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    kind: "password_reset",
    subject: "Atur ulang password My CRM",
    fromName: profile.emailFromName ?? profile.name,
    replyTo: profile.emailReplyTo,
    html: emailShell({
      accent: profile.accentColor,
      heading: "Atur ulang password",
      body: `<p>Halo ${user.name},</p><p>Kami menerima permintaan atur ulang password untuk akun Anda. Tautan ini berlaku ${RESET_TTL_MINUTES} menit.</p><p>Kalau bukan Anda yang meminta, abaikan email ini — password lama tetap berlaku.</p>`,
      cta: { label: "Atur ulang password", url },
      footer: `Tautan tidak bisa diklik? Salin: ${url}`,
    }),
    text: `Atur ulang password: ${url}`,
  });

  return done;
}

export async function resetPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Password minimal 8 karakter" };
  if (password !== confirm) return { error: "Konfirmasi password tidak cocok" };

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: "Tautan tidak valid atau sudah kedaluwarsa" };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        // Anyone still holding a session for this account is signed out.
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Any other outstanding link for this user is now void.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  await recordAudit(null, {
    action: "password.reset",
    entity: "User",
    entityId: record.userId,
    summary: `Password direset lewat tautan email untuk ${record.user.email}`,
  });

  return { success: "Password berhasil diubah. Silakan masuk." };
}
