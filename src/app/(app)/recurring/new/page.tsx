import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/invoice";
import { daysFromNowIso } from "@/lib/format";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { createRecurring } from "../actions";
import { RecurringForm } from "../recurring-form";

export const dynamic = "force-dynamic";

export default async function NewRecurringPage({
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
    <div>
      <PageHeader
        title="Langganan baru"
        description="Invoice akan dibuat otomatis sesuai jadwal"
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
          <RecurringForm
            action={createRecurring}
            clients={clients}
            values={{
              clientId,
              startDate: daysFromNowIso(),
              currency: profile.currency,
              taxRate: Number(profile.defaultTaxRate),
              withholdingRate: Number(profile.defaultWithholdingRate),
              terms: profile.defaultTerms,
            }}
            submitLabel="Simpan langganan"
            cancelHref="/recurring"
            baseCurrency={profile.currency}
          />
        )}
      </Card>
    </div>
  );
}
