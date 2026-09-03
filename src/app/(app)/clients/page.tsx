import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { invoiceBalance, toBaseAmount } from "@/lib/money";
import { clientStatusLabel } from "@/lib/labels";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
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
import type { ClientStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const page = readPage(params.page);

  const where: Prisma.ClientWhereInput = {};
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { company: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
    ];
  }
  if (status && status in clientStatusLabel) {
    where.status = status as ClientStatus;
  }

  const profile = await getCompanyProfile();
  const total = await prisma.client.count({ where });
  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      _count: {
        select: {
          deals: { where: { deletedAt: null } },
          invoices: { where: { deletedAt: null } },
        },
      },
      invoices: {
        where: { deletedAt: null },
        select: {
          total: true,
          amountPaid: true,
          status: true,
          exchangeRate: true,
        },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Klien"
        description={`${total} klien`}
        action={
          <div className="flex flex-wrap gap-2">
            {/* Route handler that streams a file — must be a real navigation,
                not a client-side Link. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/export/clients" className={buttonClass("secondary")}>
              Ekspor CSV
            </a>
            <LinkButton href="/clients/import" variant="secondary">
              Impor CSV
            </LinkButton>
            <LinkButton href="/clients/duplicates" variant="secondary">
              Cek duplikat
            </LinkButton>
            <LinkButton href="/clients/new">+ Klien baru</LinkButton>
          </div>
        }
      />

      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Cari
            </label>
            <Input name="q" defaultValue={query} placeholder="Nama, email, telepon" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <Select name="status" defaultValue={status}>
              <option value="">Semua</option>
              {Object.entries(clientStatusLabel).map(([value, label]) => (
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
            <Link href="/clients" className={buttonClass("ghost")}>
              Reset
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {clients.length === 0 ? (
          <EmptyState
            title="Belum ada klien"
            description="Tambah klien pertama untuk mulai melacak deal dan invoice."
            action={
              <LinkButton href="/clients/new" className="mt-2">
                Tambah klien
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Klien</th>
                  <th className="px-5 py-3 font-medium">Kontak</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Deal</th>
                  <th className="px-5 py-3 text-right font-medium">Piutang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => {
                  const outstanding = client.invoices
                    .filter((invoice) => invoice.status !== "CANCELLED")
                    .reduce(
                      (sum, invoice) =>
                        sum +
                        toBaseAmount(
                          invoiceBalance(invoice),
                          invoice.exchangeRate,
                        ),
                      0,
                    );
                  return (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {client.name}
                        </Link>
                        {client.company ? (
                          <p className="text-xs text-slate-500">{client.company}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        <p>{client.email ?? "-"}</p>
                        <p className="text-xs text-slate-400">
                          {client.phone ?? ""}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          value={client.status}
                          label={clientStatusLabel[client.status]}
                        />
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {client._count.deals}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-800">
                        {formatMoney(outstanding, profile.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        basePath="/clients"
        params={{ q: query, status }}
        page={page}
        total={total}
      />
    </div>
  );
}
