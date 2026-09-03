import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { Card, EmptyState, PageHeader, Select, buttonClass } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const page = Math.max(Number(params.page ?? 1) || 1, 1);
  const entity = params.entity ?? "";

  const where = entity ? { entity } : {};
  const [logs, total, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: true }),
  ]);

  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div>
      <PageHeader
        title="Log aktivitas"
        description={
          isAdmin(session)
            ? `${total} catatan perubahan`
            : `${total} catatan — Anda melihat log bersama`
        }
      />

      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Entitas
            </label>
            <Select name="entity" defaultValue={entity}>
              <option value="">Semua</option>
              {entities.map((row) => (
                <option key={row.entity} value={row.entity}>
                  {row.entity} ({row._count})
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonClass("secondary")}>
            Terapkan
          </button>
          {entity ? (
            <Link href="/audit" className={buttonClass("ghost")}>
              Reset
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {logs.length === 0 ? (
          <EmptyState
            title="Belum ada catatan"
            description="Perubahan data akan tercatat di sini."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm text-slate-800">{log.summary}</p>
                  <span className="text-xs text-slate-400">
                    {log.createdAt.toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {log.userLabel} · {log.action} · {log.entity}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <Link
            href={`/audit?entity=${entity}&page=${page - 1}`}
            className={buttonClass(page > 1 ? "secondary" : "ghost")}
            aria-disabled={page <= 1}
          >
            Sebelumnya
          </Link>
          <span className="text-xs text-slate-500">
            Halaman {page} dari {pages}
          </span>
          <Link
            href={`/audit?entity=${entity}&page=${page + 1}`}
            className={buttonClass(page < pages ? "secondary" : "ghost")}
            aria-disabled={page >= pages}
          >
            Berikutnya
          </Link>
        </div>
      ) : null}
    </div>
  );
}
