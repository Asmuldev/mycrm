import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { updateService } from "../../actions";
import { ServiceForm } from "../../service-form";

export const dynamic = "force-dynamic";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [service, clients, servers, subscriptions] = await Promise.all([
    prisma.service.findUnique({ where: { id } }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.serverNode.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.recurringInvoice.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true, client: { select: { name: true } } },
    }),
  ]);
  if (!service || service.deletedAt) notFound();

  const action = updateService.bind(null, service.id);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit layanan" description={service.name} />
      <Card className="p-5">
        <ServiceForm
          action={action}
          clients={clients}
          servers={servers}
          subscriptions={subscriptions.map((row) => ({
            id: row.id,
            title: row.title,
            clientName: row.client.name,
          }))}
          values={service}
          submitLabel="Simpan perubahan"
          cancelHref={`/services/${service.id}`}
          locked
        />
      </Card>
    </div>
  );
}
