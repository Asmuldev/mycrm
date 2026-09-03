import { reportError } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";

/**
 * Records a change for the audit trail. Never throws: a failed audit write must
 * not roll back the business action that succeeded.
 */
export async function recordAudit(
  session: SessionPayload | null,
  input: {
    action: string;
    entity: string;
    entityId?: string | null;
    summary: string;
  },
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: session?.userId ?? null,
        userLabel: session ? `${session.name} <${session.email}>` : "system",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
      },
    });
  } catch (error) {
    await reportError(error, { action: input.action, entity: input.entity });
  }
}
