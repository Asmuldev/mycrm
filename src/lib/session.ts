import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  /** User.sessionVersion at sign-in; a bump invalidates existing tokens. */
  sessionVersion: number;
};

const COOKIE_NAME = "crm_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function encodeSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Signature-only check. Safe for middleware (edge runtime, no database), but
 * callers that authorize an action must use `getSession` from `lib/auth`,
 * which also confirms the session has not been revoked.
 */
export async function decodeSession(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
