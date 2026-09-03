import { notFound } from "next/navigation";
import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { updateDeal } from "../../actions";
import { DealForm } from "../../deal-form";

export const dynamic = "force-dynamic";

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [deal, clients, profile] = await Promise.all([
    prisma.deal.findUnique({ where: { id } }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCompanyProfile(),
  ]);
  if (!deal || deal.deletedAt) notFound();

  const action = updateDeal.bind(null, deal.id);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit deal" description={deal.title} />
      <Card className="p-5">
        <DealForm
          action={action}
          clients={clients}
          values={deal}
          submitLabel="Simpan perubahan"
          cancelHref={`/deals/${deal.id}`}
          baseCurrency={profile.currency}
        />
      </Card>
    </div>
  );
}
