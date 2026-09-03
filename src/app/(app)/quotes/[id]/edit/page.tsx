import { notFound } from "next/navigation";
import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { updateQuote } from "../../actions";
import { QuoteForm } from "../../quote-form";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, clients, deals, profile] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: { items: { orderBy: { position: "asc" } } },
    }),
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
  if (!quote || quote.deletedAt) notFound();

  const action = updateQuote.bind(null, quote.id);

  return (
    <div>
      <PageHeader title="Edit penawaran" description={quote.number} />
      <Card className="p-5">
        <QuoteForm
          action={action}
          clients={clients}
          deals={deals}
          values={{
            clientId: quote.clientId,
            dealId: quote.dealId,
            status: quote.status,
            issueDate: quote.issueDate.toISOString(),
            validUntil: quote.validUntil.toISOString(),
            currency: quote.currency,
            discount: Number(quote.discount),
            taxRate: Number(quote.taxRate),
            exchangeRate: Number(quote.exchangeRate),
            notes: quote.notes,
            terms: quote.terms,
            items: quote.items.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            })),
          }}
          submitLabel="Simpan perubahan"
          cancelHref={`/quotes/${quote.id}`}
          baseCurrency={profile.currency}
        />
      </Card>
    </div>
  );
}
