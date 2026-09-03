import { requireSession } from "@/lib/auth";
import type { SessionPayload } from "@/lib/session";

export class PermissionError extends Error {
  constructor(message = "Aksi ini hanya untuk admin") {
    super(message);
    this.name = "PermissionError";
  }
}

export function isAdmin(session: SessionPayload | null) {
  return session?.role === "ADMIN";
}

/** Session guard for destructive or configuration actions. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (!isAdmin(session)) throw new PermissionError();
  return session;
}
