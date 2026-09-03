import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { expenseCategoryLabel } from "@/lib/labels";
import { toBaseAmount } from "@/lib/money";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
import {
  Card,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  buttonClass,
} from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = readPage(params.page);
  const query = params.q?.trim() ?? "";
  const category = params.category ?? "";

  const where: Prisma.ExpenseWhereInput = {};
  if (query) {
    where.OR = [
      { description: { contains: query, mode: "insensitive" } },
      { vendor: { contains: query, mode: "insensitive" } },
      { client: { name: { contains: query, mode: "insensitive" } } },
    ];
  }
  if (category && category in expenseCategoryLabel) where.category = category;
  if (params.from || params.to) {
    where.spentOn = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to ? { lte: new Date(params.to) } : {}),
    };
  }

  const [profile, total, expenses, allForTotals] = await Promise.all([
    getCompanyProfile(),
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { spentOn: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.expense.findMany({
      where,
      select: {
        amount: true,
        exchangeRate: true,
        billable: true,
        invoiceId: true,
      },
    }),
  ]);

  const totals = allForTotals.reduce(
    (acc, expense) => {
      const base = toBaseAmount(expense.amount, expense.exchangeRate);
      acc.all += base;
      if (expense.billable && !expense.invoiceId) acc.rebillable += base;
      return acc;
    },
    { all: 0, rebillable: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Biaya"
        description={`${total} catatan · total ${formatMoney(totals.all, profile.currency)} · belum ditagih ulang ${formatMoney(totals.rebillable, profile.currency)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {/* Route handler that streams a file — must be a real navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/export/expenses" className={buttonClass("secondary")}>
              Ekspor CSV
            </a>
            <LinkButton href="/expenses/new">+ Biaya baru</LinkButton>
          </div>
        }
      />

      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Cari
            </label>
            <Input name="q" defaultValue={query} placeholder="Keterangan, vendor, klien" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Kategori
            </label>
            <Select name="category" defaultValue={category}>
              <option value="">Semua</option>
              {Object.entries(expenseCategoryLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Dari
            </label>
            <Input name="from" type="date" defaultValue={params.from ?? ""} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Sampai
            </label>
            <Input name="to" type="date" defaultValue={params.to ?? ""} />
          </div>
          <button type="submit" className={buttonClass("secondary")}>
            Terapkan
          </button>
          {query || category || params.from || params.to ? (
            <Link href="/expenses" className={buttonClass("ghost")}>
              Reset
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {expenses.length === 0 ? (
          <EmptyState
            title="Belum ada biaya tercatat"
            description="Tanpa data biaya, margin per klien dan per proyek tidak bisa dihitung."
            action={
              <LinkButton href="/expenses/new" className="mt-2">
                Catat biaya
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Tanggal</th>
                  <th className="px-5 py-3 font-medium">Keterangan</th>
                  <th className="px-5 py-3 font-medium">Kategori</th>
                  <th className="px-5 py-3 font-medium">Klien / proyek</th>
                  <th className="px-5 py-3 text-right font-medium">Nominal</th>
                  <th className="px-5 py-3 font-medium">Tagih ulang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(expense.spentOn)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/expenses/${expense.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {expense.description}
                      </Link>
                      {expense.vendor ? (
                        <p className="text-xs text-slate-500">{expense.vendor}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {expenseCategoryLabel[expense.category] ?? expense.category}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {expense.client ? (
                        <Link
                          href={`/clients/${expense.client.id}`}
                          className="hover:underline"
                        >
                          {expense.client.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Umum</span>
                      )}
                      {expense.project ? (
                        <p className="text-xs text-slate-500">
                          {expense.project.name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-800">
                      {formatMoney(expense.amount, expense.currency)}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600">
                      {!expense.billable
                        ? "-"
                        : expense.invoiceId
                          ? "Sudah ditagih"
                          : "Belum ditagih"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        basePath="/expenses"
        params={{ q: query, category, from: params.from, to: params.to }}
        page={page}
        total={total}
      />
    </div>
  );
}
