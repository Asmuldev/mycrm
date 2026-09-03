import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/invoice";
import { daysFromNowIso } from "@/lib/format";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { createQuote } from "../actions";
import { QuoteForm } from "../quote-form";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; dealId?: string }>;
}) {
  const { clientId, dealId } = await searchParams;
  const [clients, deals, profile] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.deal.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
    getCompanyProfile(),
  ]);

  return (
    <div>
      <PageHeader
        title="Penawaran baru"
        description="Kirim ke klien, konversi jadi invoice saat disetujui"
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
          <QuoteForm
            action={createQuote}
            clients={clients}
            deals={deals}
            values={{
              clientId,
              dealId,
              issueDate: daysFromNowIso(),
              validUntil: daysFromNowIso(30),
              currency: profile.currency,
              taxRate: Number(profile.defaultTaxRate),
              terms: profile.defaultTerms,
            }}
            submitLabel="Simpan penawaran"
            cancelHref="/quotes"
            baseCurrency={profile.currency}
          />
        )}
      </Card>
    </div>
  );
}
