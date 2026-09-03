import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retention windows, in days. Audit history is kept longest on purpose. */
const RETENTION = {
  loginAttempts: 30,
  emailLogs: 180,
  auditLogs: 365,
  usedResetTokens: 7,
};

function cutoff(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const [loginAttempts, emailLogs, auditLogs, resetTokens] = await Promise.all([
    prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: cutoff(RETENTION.loginAttempts) } },
    }),
    prisma.emailLog.deleteMany({
      where: { createdAt: { lt: cutoff(RETENTION.emailLogs) } },
    }),
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff(RETENTION.auditLogs) } },
    }),
    // Expired or already-used links carry no value once they cannot be redeemed.
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { usedAt: { lt: cutoff(RETENTION.usedResetTokens) } },
          { expiresAt: { lt: cutoff(RETENTION.usedResetTokens) } },
        ],
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    deleted: {
      loginAttempts: loginAttempts.count,
      emailLogs: emailLogs.count,
      auditLogs: auditLogs.count,
      resetTokens: resetTokens.count,
    },
    retentionDays: RETENTION,
  });
}
