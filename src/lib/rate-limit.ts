import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

export async function getClientIp() {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return store.get("x-real-ip") ?? "unknown";
}

function windowStart() {
  return new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
}

export async function recordLoginAttempt(
  email: string,
  ip: string,
  success: boolean,
) {
  await prisma.loginAttempt.create({
    data: { email: email.toLowerCase(), ip, success },
  });
}

/**
 * Blocks brute force by counting recent failures for the email and the IP.
 * A successful login clears the email's failure streak.
 */
export async function checkLoginRateLimit(email: string, ip: string) {
  const since = windowStart();
  const [emailFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email: email.toLowerCase(), success: false, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { ip, success: false, createdAt: { gte: since } },
    }),
  ]);

  if (emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP) {
    return {
      blocked: true as const,
      message: `Terlalu banyak percobaan login. Coba lagi dalam ${WINDOW_MINUTES} menit.`,
    };
  }
  return { blocked: false as const };
}

export async function clearLoginFailures(email: string) {
  await prisma.loginAttempt.deleteMany({
    where: { email: email.toLowerCase(), success: false },
  });
}
