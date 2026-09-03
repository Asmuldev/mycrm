"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type TrashKind = "client" | "deal" | "quote" | "invoice";

const LABELS: Record<TrashKind, string> = {
  client: "Klien",
  deal: "Deal",
  quote: "Penawaran",
  invoice: "Invoice",
};

/** Guards purge so only rows already in the trash can be destroyed. */
async function isArchived(kind: TrashKind, id: string) {
  const where = { id, deletedAt: { not: null } } as const;
  switch (kind) {
    case "client":
      return (await prisma.client.count({ where })) > 0;
    case "deal":
      return (await prisma.deal.count({ where })) > 0;
    case "quote":
      return (await prisma.quote.count({ where })) > 0;
    case "invoice":
      return (await prisma.invoice.count({ where })) > 0;
  }
}

export async function restoreItem(
  kind: TrashKind,
  id: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const data = { deletedAt: null };

  if (kind === "client") await prisma.client.update({ where: { id }, data });
  if (kind === "deal") await prisma.deal.update({ where: { id }, data });
  if (kind === "quote") await prisma.quote.update({ where: { id }, data });
  if (kind === "invoice") await prisma.invoice.update({ where: { id }, data });

  await recordAudit(session, {
    action: `${kind}.restore`,
    entity: LABELS[kind],
    entityId: id,
    summary: `Memulihkan ${LABELS[kind].toLowerCase()} dari sampah`,
  });
  revalidatePath("/trash");
  revalidatePath(`/${kind}s`);
}

/** Irreversible. Only reachable from the trash page, admin only. */
export async function purgeItem(
  kind: TrashKind,
  id: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!(await isArchived(kind, id))) {
    return { error: "Item tidak ada di sampah" };
  }

  // Financial records keep a client alive on purpose: deleting the client would
  // orphan invoices that must stay auditable.
  if (kind === "client") {
    const [invoices, notes] = await Promise.all([
      // Archived invoices count too: purging the client would orphan them.
      prisma.invoice.count({ where: { clientId: id, OR: [{ deletedAt: null }, { deletedAt: { not: null } }] } }),
      prisma.creditNote.count({ where: { clientId: id } }),
    ]);
    if (invoices > 0 || notes > 0) {
      return {
        error: `Klien ini masih punya ${invoices} invoice dan ${notes} nota kredit. Hapus permanen dokumen itu dulu, atau biarkan klien tetap di sampah.`,
      };
    }
  }

  if (kind === "client") await prisma.client.delete({ where: { id } });
  if (kind === "deal") await prisma.deal.delete({ where: { id } });
  if (kind === "quote") await prisma.quote.delete({ where: { id } });
  if (kind === "invoice") await prisma.invoice.delete({ where: { id } });

  await recordAudit(session, {
    action: `${kind}.purge`,
    entity: LABELS[kind],
    entityId: id,
    summary: `Menghapus permanen ${LABELS[kind].toLowerCase()} dari sampah`,
  });
  revalidatePath("/trash");
}
