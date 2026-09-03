import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

/**
 * Sessions for people on the client side of the portal.
 *
 * Kept completely separate from the staff session: a different cookie, a
 * different payload shape, and a `kind` claim that is checked on every read.
 * A staff token handed to this verifier is rejected, and vice versa, so no
 * mistake in one area can widen access in the other.
 */
export type ClientSession = {
  kind: "client";
  clientUserId: string;
  clientId: string;
  email: string;
  name: string;
  sessionVersion: number;
};

const COOKIE_NAME = "crm_client_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  // Separate salt so a staff token can never validate as a client token.
  return new TextEncoder().encode(`${secret}::client-portal`);
}

export async function createClientSessionCookie(payload: ClientSession) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyClientSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Returns the signed-in client user, or null. Re-reads the account each time so
 * deactivating a user or bumping their session version logs them out at once.
 */
export async function getClientSession(): Promise<ClientSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  let payload: ClientSession;
  try {
    const verified = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    payload = verified.payload as unknown as ClientSession;
  } catch {
    return null;
  }

  if (payload.kind !== "client" || !payload.clientUserId) return null;

  const user = await prisma.clientUser.findUnique({
    where: { id: payload.clientUserId },
    include: { client: { select: { id: true, deletedAt: true } } },
  });

  if (!user || !user.active) return null;
  if (user.sessionVersion !== payload.sessionVersion) return null;
  if (user.client.deletedAt) return null;

  return {
    kind: "client",
    clientUserId: user.id,
    clientId: user.clientId,
    email: user.email,
    name: user.name,
    sessionVersion: user.sessionVersion,
  };
}

export { COOKIE_NAME as CLIENT_COOKIE_NAME };
