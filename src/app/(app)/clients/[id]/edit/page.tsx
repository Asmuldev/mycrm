import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { updateClient } from "../../actions";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.deletedAt) notFound();

  const action = updateClient.bind(null, client.id);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit klien" description={client.name} />
      <Card className="p-5">
        <ClientForm
          action={action}
          values={client}
          submitLabel="Simpan perubahan"
          cancelHref={`/clients/${client.id}`}
        />
      </Card>
    </div>
  );
}
