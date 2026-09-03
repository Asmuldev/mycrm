import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export function hashPortalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generatePortalToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Resolves a portal link to its client. Returns null for unknown, revoked, or
 * expired tokens so the page can render one generic "invalid link" state.
 */
export async function resolvePortalToken(token: string) {
  if (!token || token.length < 20) return null;

  const record = await prisma.portalToken.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    include: { client: true },
  });

  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;
  if (record.client.deletedAt) return null;

  return record;
}

export async function touchPortalToken(id: string) {
  await prisma.portalToken.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}
