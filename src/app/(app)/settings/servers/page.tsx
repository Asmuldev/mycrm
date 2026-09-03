import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import {
  deleteServerNode,
  syncServer,
  testServer,
  toggleServer,
} from "./actions";
import { ServerForm } from "./server-form";

export const dynamic = "force-dynamic";

export default async function ServersPage() {
  const session = await requireSession();
  const admin = isAdmin(session);

  const nodes = await prisma.serverNode.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { services: true } } },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Server"
        description="Panel hosting yang dibaca aplikasi ini untuk memantau layanan klien"
      />

      <Card>
        <CardHeader title="Server terdaftar" description={`${nodes.length} server`} />
        {nodes.length === 0 ? (
          <EmptyState
            title="Belum ada server"
            description="Tambahkan aaPanel Anda untuk mulai memantau layanan klien."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {nodes.map((node) => {
              const test = testServer.bind(null, node.id);
              const sync = syncServer.bind(null, node.id);
              const toggle = toggleServer.bind(null, node.id);
              const remove = deleteServerNode.bind(null, node.id);
              const healthy = node.lastStatus === "OK";

              return (
                <li key={node.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {node.name}
                        {node.active ? null : (
                          <span className="ml-2 text-xs text-slate-400">
                            (nonaktif)
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {node.baseUrl}
                        {node.panelVersion ? ` · panel ${node.panelVersion}` : ""}
                        {" · "}
                        {node._count.services} layanan
                      </p>
                      <p className="mt-1 text-xs">
                        <span
                          className={
                            healthy ? "text-emerald-700" : "text-rose-700"
                          }
                        >
                          {node.lastStatus ?? "Belum pernah diuji"}
                        </span>
                        {node.lastCheckedAt ? (
                          <span className="text-slate-400">
                            {" "}
                            · {formatDateTime(node.lastCheckedAt)}
                          </span>
                        ) : null}
                      </p>
                    </div>

                    {admin ? (
                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          action={test}
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          pendingLabel="Menguji..."
                        >
                          Uji koneksi
                        </ActionButton>
                        <ActionButton
                          action={sync}
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          pendingLabel="Sinkron..."
                        >
                          Sinkronkan
                        </ActionButton>
                        <ActionButton
                          action={toggle}
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          pendingLabel="..."
                        >
                          {node.active ? "Nonaktifkan" : "Aktifkan"}
                        </ActionButton>
                        <ActionButton
                          action={remove}
                          message={`Hapus server ${node.name}?`}
                          variant="ghost"
                          className="px-2 py-1 text-xs text-rose-600"
                        >
                          Hapus
                        </ActionButton>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {admin ? (
        <Card className="mt-4">
          <CardHeader
            title="Tambah server"
            description="Koneksi diuji langsung setelah disimpan"
          />
          <ServerForm />
        </Card>
      ) : null}

      <p className="mt-4 text-xs text-slate-500">
        Tahap ini hanya membaca dari panel. Tidak ada tombol di sini yang
        mengubah apa pun di server Anda.{" "}
        <Link href="/services" className="underline">
          Lihat layanan klien
        </Link>
      </p>
    </div>
  );
}
