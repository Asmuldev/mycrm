import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { quoteStatusLabel } from "@/lib/labels";
import { getCompanyProfile, syncExpiredQuotes } from "@/lib/invoice";
import { toBaseAmount } from "@/lib/money";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await syncExpiredQuotes();

  const page = readPage((await searchParams).page);
  const profile = await getCompanyProfile();
  const [total, quotes, allForTotals] = await Promise.all([
    prisma.quote.count(),
    prisma.quote.findMany({
      include: {
        client: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
      },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.quote.findMany({
      select: { status: true, total: true, exchangeRate: true },
    }),
  ]);

  const openValue = allForTotals
    .filter((quote) => quote.status === "SENT" || quote.status === "DRAFT")
    .reduce(
      (sum, quote) => sum + toBaseAmount(quote.total, quote.exchangeRate),
      0,
    );

  return (
    <div>
      <PageHeader
        title="Penawaran"
        description={`${total} penawaran · nilai terbuka ${formatMoney(openValue, profile.currency)}`}
        action={<LinkButton href="/quotes/new">+ Penawaran baru</LinkButton>}
      />

      <Card>
        {quotes.length === 0 ? (
          <EmptyState
            title="Belum ada penawaran"
            description="Buat penawaran dan konversi jadi invoice saat disetujui."
            action={
              <LinkButton href="/quotes/new" className="mt-2">
                Buat penawaran
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Nomor</th>
                  <th className="px-5 py-3 font-medium">Klien</th>
                  <th className="px-5 py-3 font-medium">Terbit</th>
                  <th className="px-5 py-3 font-medium">Berlaku sampai</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {quote.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/clients/${quote.client.id}`}
                        className="text-slate-600 hover:underline"
                      >
                        {quote.client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(quote.issueDate)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(quote.validUntil)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {formatMoney(quote.total, quote.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        value={quote.status}
                        label={quoteStatusLabel[quote.status]}
                      />
                    </td>
                    <td className="px-5 py-3">
                      {quote.invoice ? (
                        <Link
                          href={`/invoices/${quote.invoice.id}`}
                          className="text-xs text-slate-600 underline"
                        >
                          {quote.invoice.number}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        basePath="/quotes"
        params={{}}
        page={page}
        total={total}
      />
    </div>
  );
}
