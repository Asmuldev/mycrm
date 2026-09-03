import { prisma } from "@/lib/prisma";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { listUnmappedSites } from "../../settings/servers/actions";
import { createService } from "../actions";
import { ServiceForm } from "../service-form";

export const dynamic = "force-dynamic";

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; serverNodeId?: string }>;
}) {
  const params = await searchParams;

  const [clients, servers, subscriptions] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.serverNode.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.recurringInvoice.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, client: { select: { name: true } } },
    }),
  ]);

  // Pick the first server by default so the site list is useful immediately.
  const serverNodeId = params.serverNodeId ?? servers[0]?.id;
  const sites = serverNodeId
    ? (await listUnmappedSites(serverNodeId)).sites
    : [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Layanan baru"
        description="Hubungkan situs yang sudah ada di panel ke klien yang membayarnya"
      />
      <Card className="p-5">
        {clients.length === 0 ? (
          <EmptyState
            title="Belum ada klien"
            action={
              <LinkButton href="/clients/new" className="mt-2">
                Tambah klien
              </LinkButton>
            }
          />
        ) : (
          <ServiceForm
            action={createService}
            clients={clients}
            servers={servers}
            sites={sites}
            subscriptions={subscriptions.map((row) => ({
              id: row.id,
              title: row.title,
              clientName: row.client.name,
            }))}
            values={{ clientId: params.clientId, serverNodeId }}
            submitLabel="Simpan layanan"
            cancelHref="/services"
          />
        )}
      </Card>

      {servers.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          Belum ada server terdaftar.{" "}
          <a href="/settings/servers" className="underline">
            Tambahkan aaPanel dulu
          </a>{" "}
          supaya layanan bisa dipantau otomatis.
        </p>
      ) : null}
    </div>
  );
}
