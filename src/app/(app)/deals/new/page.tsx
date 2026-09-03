import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { createDeal } from "../actions";
import { DealForm } from "../deal-form";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const [clients, profile] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCompanyProfile(),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Deal baru" description="Tambah peluang ke pipeline" />
      <Card className="p-5">
        {clients.length === 0 ? (
          <EmptyState
            title="Belum ada klien"
            description="Deal harus terhubung ke klien."
            action={
              <LinkButton href="/clients/new" className="mt-2">
                Tambah klien
              </LinkButton>
            }
          />
        ) : (
          <DealForm
            action={createDeal}
            clients={clients}
            values={{ clientId }}
            submitLabel="Simpan deal"
            cancelHref="/deals"
            baseCurrency={profile.currency}
          />
        )}
      </Card>
    </div>
  );
}
