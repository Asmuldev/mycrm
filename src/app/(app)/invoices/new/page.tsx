import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/invoice";
import { daysFromNowIso } from "@/lib/format";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { createInvoice } from "../actions";
import { InvoiceForm } from "../invoice-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
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
      <PageHeader title="Invoice baru" description="Susun tagihan untuk klien" />
      <Card className="p-5">
        {clients.length === 0 ? (
          <EmptyState
            title="Belum ada klien"
            description="Invoice harus ditujukan ke klien."
            action={
              <LinkButton href="/clients/new" className="mt-2">
                Tambah klien
              </LinkButton>
            }
          />
        ) : (
          <InvoiceForm
            action={createInvoice}
            clients={clients}
            values={{
              clientId,
              issueDate: daysFromNowIso(),
              dueDate: daysFromNowIso(14),
              currency: profile.currency,
              taxRate: Number(profile.defaultTaxRate),
              withholdingRate: Number(profile.defaultWithholdingRate),
              terms: profile.defaultTerms,
            }}
            submitLabel="Simpan invoice"
            cancelHref="/invoices"
            baseCurrency={profile.currency}
          />
        )}
      </Card>
    </div>
  );
}
