import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { creditNoteStatusLabel } from "@/lib/labels";
import { toBaseAmount } from "@/lib/money";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = readPage((await searchParams).page);
  const [profile, total, notes, issued] = await Promise.all([
    getCompanyProfile(),
    prisma.creditNote.count(),
    prisma.creditNote.findMany({
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
      },
    }),
    prisma.creditNote.findMany({
      where: { status: "ISSUED" },
      select: { total: true, exchangeRate: true },
    }),
  ]);

  const issuedTotal = issued.reduce(
    (sum, note) => sum + toBaseAmount(note.total, note.exchangeRate),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Nota kredit"
        description={`${total} nota · total terbit ${formatMoney(issuedTotal, profile.currency)}`}
      />

      <Card>
        {notes.length === 0 ? (
          <EmptyState
            title="Belum ada nota kredit"
            description="Nota kredit dibuat dari halaman invoice yang perlu dikoreksi."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Nomor</th>
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Klien</th>
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  <th className="px-5 py-3 font-medium">Alasan</th>
                  <th className="px-5 py-3 text-right font-medium">Nilai</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {notes.map((note) => (
                  <tr key={note.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/credit-notes/${note.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {note.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/invoices/${note.invoice.id}`}
                        className="text-slate-600 hover:underline"
                      >
                        {note.invoice.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {note.client.name}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(note.issueDate)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{note.reason}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {formatMoney(note.total, note.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        value={note.status}
                        label={creditNoteStatusLabel[note.status]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        basePath="/credit-notes"
        params={{}}
        page={page}
        total={total}
      />
    </div>
  );
}
