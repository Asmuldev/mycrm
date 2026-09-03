import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { dealStageLabel } from "@/lib/labels";
import {
  cashflowProjection,
  clientProfitability,
  monthlyProfit,
  pipelineSummary,
  receivableAging,
  topClients,
} from "@/lib/reports";
import { Card, CardHeader, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const exports = [
  { type: "clients", label: "Klien" },
  { type: "invoices", label: "Invoice" },
  { type: "payments", label: "Pembayaran" },
  { type: "deals", label: "Deal" },
  { type: "revenue", label: "Omzet bulanan" },
  { type: "aging", label: "Aging piutang" },
  { type: "top-clients", label: "Klien teratas" },
  { type: "expenses", label: "Biaya" },
];

const taxExports = [
  { type: "efaktur", label: "Rekap PPN keluaran" },
  { type: "pph23", label: "Rekap PPh 23 dipotong" },
];

export default async function ReportsPage() {
  const [revenue, aging, clients, pipeline, profile, cashflow, profitability] =
    await Promise.all([
      monthlyProfit(12),
      receivableAging(),
      topClients(10),
      pipelineSummary(),
      getCompanyProfile(),
      cashflowProjection(),
      clientProfitability(10),
    ]);

  const pendingSlips = await prisma.invoice.count({
    where: {
      status: { notIn: ["DRAFT", "CANCELLED"] },
      withholdingAmount: { gt: 0 },
      withholdingSlipNumber: null,
    },
  });
  const base = profile.currency;

  const peak = Math.max(
    1,
    ...revenue.map((row) => Math.max(row.billed, row.collected, row.cost)),
  );
  const cashflowPeak = Math.max(1, ...cashflow.map((row) => row.inflow));
  const totalCost = revenue.reduce((sum, row) => sum + row.cost, 0);
  const agingTotal = aging.reduce((sum, bucket) => sum + bucket.amount, 0);
  const totalBilled = revenue.reduce((sum, row) => sum + row.billed, 0);
  const totalCollected = revenue.reduce((sum, row) => sum + row.collected, 0);

  return (
    <div>
      <PageHeader
        title="Laporan"
        description="Omzet, piutang, dan performa penjualan"
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tertagih 12 bulan" value={formatMoney(totalBilled, base)} />
        <Stat label="Terkumpul 12 bulan" value={formatMoney(totalCollected, base)} />
        <Stat
          label="Total piutang"
          value={formatMoney(agingTotal, base)}
        />
        <Stat
          label="Win rate deal"
          value={`${pipeline.winRate.toFixed(0)}%`}
          hint={`Menang ${formatMoney(pipeline.wonValue, base)}`}
        />
      </div>

      <Card className="mb-4 p-4">
        <p className="text-xs font-medium text-slate-500">Biaya 12 bulan</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">
          {formatMoney(totalCost, base)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Laba kotor {formatMoney(totalBilled - totalCost, base)}
        </p>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Omzet per bulan"
          description="Batang gelap = tertagih, terang = terkumpul, merah = biaya"
        />
        <div className="overflow-x-auto px-5 py-5">
          <div className="flex min-w-[640px] items-end gap-3">
            {revenue.map((row) => (
              <div key={row.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 rounded-t bg-slate-800"
                    style={{ height: `${(row.billed / peak) * 100}%` }}
                    title={`Tertagih ${formatMoney(row.billed, base)}`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-emerald-400"
                    style={{ height: `${(row.collected / peak) * 100}%` }}
                    title={`Terkumpul ${formatMoney(row.collected, base)}`}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Aging piutang"
            description="Umur tagihan yang belum lunas"
          />
          <ul className="divide-y divide-slate-100">
            {aging.map((bucket) => (
              <li
                key={bucket.label}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{bucket.label}</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-slate-700"
                      style={{
                        width: `${agingTotal > 0 ? (bucket.amount / agingTotal) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {formatMoney(bucket.amount, base)}
                  </p>
                  <p className="text-xs text-slate-500">{bucket.count} invoice</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Pipeline per tahap" />
          <ul className="divide-y divide-slate-100">
            {pipeline.byStage.map((row) => (
              <li
                key={row.stage}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <span className="text-sm text-slate-800">
                  {dealStageLabel[row.stage] ?? row.stage}
                </span>
                <span className="text-sm text-slate-600">
                  {row.count} deal · {formatMoney(row.value, base)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Proyeksi arus kas"
          description="Uang yang diharapkan masuk berdasarkan jatuh tempo"
        />
        <ul className="divide-y divide-slate-100">
          {cashflow.map((bucket) => (
            <li
              key={bucket.label}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    bucket.overdue ? "text-rose-700" : "text-slate-800"
                  }`}
                >
                  {bucket.label}
                </p>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full ${
                      bucket.overdue ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${(bucket.inflow / cashflowPeak) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatMoney(bucket.inflow, base)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Margin per klien"
          description="Nilai tertagih dikurangi biaya yang tercatat untuk klien itu"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Klien</th>
                <th className="px-5 py-3 text-right font-medium">Tertagih</th>
                <th className="px-5 py-3 text-right font-medium">Biaya</th>
                <th className="px-5 py-3 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profitability.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/clients/${row.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-800">
                    {formatMoney(row.billed, base)}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {formatMoney(row.cost, base)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-medium ${
                      row.margin < 0 ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {formatMoney(row.margin, base)}
                    <span className="ml-1 text-xs text-slate-400">
                      {row.marginPercent.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Klien teratas" description="Berdasarkan nilai tertagih" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Klien</th>
                <th className="px-5 py-3 text-right font-medium">Invoice</th>
                <th className="px-5 py-3 text-right font-medium">Tertagih</th>
                <th className="px-5 py-3 text-right font-medium">Terkumpul</th>
                <th className="px-5 py-3 text-right font-medium">Piutang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {client.invoices}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-800">
                    {formatMoney(client.billed, base)}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {formatMoney(client.collected, base)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-slate-900">
                    {formatMoney(client.outstanding, base)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Ekspor CSV"
          description="Buka di Excel atau kirim ke akuntan"
        />
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {exports.map((item) => (
            <a
              key={item.type}
              href={`/api/export/${item.type}`}
              className={buttonClass("secondary")}
            >
              {item.label}
            </a>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Rekap pajak"
          description="Bahan untuk input e-Faktur dan pelaporan PPh 23"
        />
        <div className="px-5 py-4">
          {pendingSlips > 0 ? (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {pendingSlips} invoice sudah dipotong PPh 23 tapi bukti potongnya
              belum dicatat.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {taxExports.map((item) => (
              <a
                key={item.type}
                href={`/api/export/${item.type}`}
                className={buttonClass("secondary")}
              >
                {item.label}
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Berkas ini bukan file impor e-Faktur resmi. Isinya adalah rekap
            kolom yang dibutuhkan saat menginput faktur, supaya tidak perlu
            menyalin satu per satu dari halaman invoice.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}
