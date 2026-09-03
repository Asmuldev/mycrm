import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import { getCompanyProfile, syncOverdueInvoices } from "@/lib/invoice";
import { invoiceBalance, toBaseAmount } from "@/lib/money";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { BulkInvoiceForm } from "./bulk-bar";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  buttonClass,
} from "@/components/ui";
import type { InvoiceStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await syncOverdueInvoices();

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const page = readPage(params.page);

  const where: Prisma.InvoiceWhereInput = {};
  if (query) {
    where.OR = [
      { number: { contains: query, mode: "insensitive" } },
      { client: { name: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (status && status in invoiceStatusLabel) {
    where.status = status as InvoiceStatus;
  }

  const session = await requireSession();
  const profile = await getCompanyProfile();
  const [total, invoices, allForTotals] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { client: { select: { id: true, name: true } } },
      orderBy: { issueDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Header totals cover the whole filtered set, not just this page.
    prisma.invoice.findMany({
      where,
      select: { status: true, total: true, amountPaid: true, exchangeRate: true },
    }),
  ]);

  const totals = allForTotals.reduce(
    (acc, invoice) => {
      if (invoice.status === "CANCELLED") return acc;
      acc.billed += toBaseAmount(invoice.total, invoice.exchangeRate);
      acc.paid += toBaseAmount(invoice.amountPaid, invoice.exchangeRate);
      return acc;
    },
    { billed: 0, paid: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Invoice"
        description={`Tertagih ${formatMoney(totals.billed, profile.currency)} · terkumpul ${formatMoney(totals.paid, profile.currency)} · sisa ${formatMoney(Math.max(totals.billed - totals.paid, 0), profile.currency)}`}
        action={<LinkButton href="/invoices/new">+ Invoice baru</LinkButton>}
      />

      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Cari
            </label>
            <Input name="q" defaultValue={query} placeholder="Nomor atau klien" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <Select name="status" defaultValue={status}>
              <option value="">Semua</option>
              {Object.entries(invoiceStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonClass("secondary")}>
            Terapkan
          </button>
          {query || status ? (
            <Link href="/invoices" className={buttonClass("ghost")}>
              Reset
            </Link>
          ) : null}
        </form>
      </Card>

      <BulkInvoiceForm canDelete={isAdmin(session)}>
      <Card>
        {invoices.length === 0 ? (
          <EmptyState
            title="Belum ada invoice"
            description="Buat invoice pertama untuk klien Anda."
            action={
              <LinkButton href="/invoices/new" className="mt-2">
                Buat invoice
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-5 py-3" />
                  <th className="px-5 py-3 font-medium">Nomor</th>
                  <th className="px-5 py-3 font-medium">Klien</th>
                  <th className="px-5 py-3 font-medium">Terbit</th>
                  <th className="px-5 py-3 font-medium">Jatuh tempo</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                  <th className="px-5 py-3 text-right font-medium">Sisa</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        name="invoiceId"
                        value={invoice.id}
                        aria-label={`Pilih ${invoice.number}`}
                        className="rounded"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/clients/${invoice.client.id}`}
                        className="text-slate-600 hover:underline"
                      >
                        {invoice.client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-800">
                      {formatMoney(invoice.total, invoice.currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {formatMoney(
                        invoiceBalance(invoice),
                        invoice.currency,
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        value={invoice.status}
                        label={invoiceStatusLabel[invoice.status]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </BulkInvoiceForm>

      <Pagination
        basePath="/invoices"
        params={{ q: query, status }}
        page={page}
        total={total}
      />
    </div>
  );
}
