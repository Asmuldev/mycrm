import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  COOKIE_NAME,
  MAX_AGE_SECONDS,
  decodeSession,
  encodeSession,
  type SessionPayload,
} from "@/lib/session";

/**
 * Verifies the cookie signature and then confirms the user still exists and
 * their session has not been revoked. Deleting a user, changing their role, or
 * changing a password bumps `sessionVersion`, which logs out live sessions
 * instead of leaving the token valid until it expires a week later.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const payload = await decodeSession(store.get(COOKIE_NAME)?.value);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sessionVersion: true,
    },
  });

  if (!user || user.sessionVersion !== payload.sessionVersion) return null;

  // Role and name come from the database so a change takes effect immediately.
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await encodeSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
