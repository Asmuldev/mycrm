import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatMoney } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { purgeItem, restoreItem, type TrashKind } from "./actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  subtitle: string;
  deletedAt: Date;
};

export default async function TrashPage() {
  const session = await requireSession();
  const admin = isAdmin(session);

  const archived = { not: null } as const;
  const [clients, deals, quotes, invoices] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: archived },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.deal.findMany({
      where: { deletedAt: archived },
      orderBy: { deletedAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    prisma.quote.findMany({
      where: { deletedAt: archived },
      orderBy: { deletedAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { deletedAt: archived },
      orderBy: { deletedAt: "desc" },
      include: { client: { select: { name: true } } },
    }),
  ]);

  const groups: Array<{ kind: TrashKind; label: string; rows: Row[] }> = [
    {
      kind: "client",
      label: "Klien",
      rows: clients.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: row.company ?? row.email ?? "-",
        deletedAt: row.deletedAt!,
      })),
    },
    {
      kind: "deal",
      label: "Deal",
      rows: deals.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: `${row.client.name} · ${formatMoney(row.value, row.currency)}`,
        deletedAt: row.deletedAt!,
      })),
    },
    {
      kind: "quote",
      label: "Penawaran",
      rows: quotes.map((row) => ({
        id: row.id,
        title: row.number,
        subtitle: `${row.client.name} · ${formatMoney(row.total, row.currency)}`,
        deletedAt: row.deletedAt!,
      })),
    },
    {
      kind: "invoice",
      label: "Invoice",
      rows: invoices.map((row) => ({
        id: row.id,
        title: row.number,
        subtitle: `${row.client.name} · ${formatMoney(row.total, row.currency)}`,
        deletedAt: row.deletedAt!,
      })),
    },
  ];

  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Sampah"
        description={
          admin
            ? `${total} item terarsip. Pulihkan kapan saja, atau hapus permanen.`
            : `${total} item terarsip. Hanya admin yang bisa memulihkan.`
        }
      />

      {total === 0 ? (
        <Card>
          <EmptyState
            title="Sampah kosong"
            description="Data yang dihapus akan muncul di sini, bukan hilang seketika."
          />
        </Card>
      ) : (
        groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <Card key={group.kind} className="mb-4">
              <CardHeader
                title={group.label}
                description={`${group.rows.length} item`}
              />
              <ul className="divide-y divide-slate-100">
                {group.rows.map((row) => {
                  const restore = restoreItem.bind(null, group.kind, row.id);
                  const purge = purgeItem.bind(null, group.kind, row.id);

                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {row.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.subtitle} · dihapus {formatDateTime(row.deletedAt)}
                        </p>
                      </div>
                      {admin ? (
                        <div className="flex flex-wrap gap-2">
                          <ActionButton
                            action={restore}
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            pendingLabel="..."
                          >
                            Pulihkan
                          </ActionButton>
                          <ActionButton
                            action={purge}
                            message={`Hapus permanen "${row.title}"? Tindakan ini tidak bisa dibatalkan.`}
                            variant="ghost"
                            className="px-2 py-1 text-xs text-rose-600"
                          >
                            Hapus permanen
                          </ActionButton>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))
      )}

      <p className="mt-4 text-xs text-slate-500">
        Menghapus permanen juga menghapus data terkait seperti item, pembayaran,
        dan lampiran.{" "}
        <Link href="/audit" className="underline">
          Semua tindakan tercatat di log aktivitas.
        </Link>
      </p>
    </div>
  );
}
