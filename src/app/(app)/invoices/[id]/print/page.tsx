import { formatDate, formatMoney } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import {
  clientAddressLines,
  companyAddressLines,
  requireInvoiceView,
} from "@/lib/invoice-view";
import { LinkButton } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const statusTone: Record<string, string> = {
  DRAFT: "bg-slate-200 text-slate-700",
  SENT: "bg-sky-100 text-sky-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-200 text-slate-600",
};

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { company, invoice, client, items, payments, schedules } =
    await requireInvoiceView(id);
  const accent = company.accentColor || "#0f172a";

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <PrintButton />
        <LinkButton href={`/invoices/${invoice.id}/pdf`} variant="secondary">
          Unduh PDF
        </LinkButton>
        <LinkButton href={`/invoices/${invoice.id}`} variant="secondary">
          Kembali
        </LinkButton>
      </div>

      <div className="print-area force-light mx-auto max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5" style={{ backgroundColor: accent }} />

        <div className="px-10 py-9">
          <div className="flex items-start justify-between gap-8">
            <div className="max-w-xs">
              {company.logoUrl ? (
                // Data URI stored on the company profile.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="mb-3 max-h-14 max-w-[180px] object-contain"
                />
              ) : null}
              <p className="text-base font-semibold text-slate-900">
                {company.name}
              </p>
              <div className="mt-1 space-y-0.5 text-xs leading-snug text-slate-500">
                {companyAddressLines(company).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <div className="text-right">
              <p
                className="text-3xl font-bold tracking-[0.2em]"
                style={{ color: accent }}
              >
                INVOICE
              </p>
              <p className="mt-1 text-sm text-slate-600">{invoice.number}</p>
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${
                  statusTone[invoice.status] ?? statusTone.DRAFT
                }`}
              >
                {(invoiceStatusLabel[invoice.status] ?? invoice.status).toUpperCase()}
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">
                DITAGIHKAN KEPADA
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900">
                {client.name}
              </p>
              <div className="mt-0.5 space-y-0.5 text-xs leading-snug text-slate-500">
                {clientAddressLines(client).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <dl className="w-56 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500">Tanggal terbit</dt>
                <dd className="font-medium text-slate-900">
                  {formatDate(invoice.issueDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Jatuh tempo</dt>
                <dd className="font-medium text-slate-900">
                  {formatDate(invoice.dueDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Mata uang</dt>
                <dd className="font-medium text-slate-900">{invoice.currency}</dd>
              </div>
            </dl>
          </div>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: accent }}>
                <th className="rounded-l px-3 py-2 text-left text-[10px] font-bold tracking-[0.1em] text-white">
                  DESKRIPSI
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-bold tracking-[0.1em] text-white">
                  QTY
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-bold tracking-[0.1em] text-white">
                  HARGA
                </th>
                <th className="rounded-r px-3 py-2 text-right text-[10px] font-bold tracking-[0.1em] text-white">
                  JUMLAH
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id}
                  className={`border-b border-slate-100 ${
                    index % 2 === 1 ? "bg-slate-50/70" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 text-slate-800">
                    {item.description}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    {formatMoney(item.unitPrice, invoice.currency)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium text-slate-900">
                    {formatMoney(item.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 flex justify-end">
            <dl className="w-72 text-sm">
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="text-slate-800">
                  {formatMoney(invoice.subtotal, invoice.currency)}
                </dd>
              </div>
              {invoice.discount > 0 ? (
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">Diskon</dt>
                  <dd className="text-slate-800">
                    -{formatMoney(invoice.discount, invoice.currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">PPN ({invoice.taxRate}%)</dt>
                <dd className="text-slate-800">
                  {formatMoney(invoice.taxAmount, invoice.currency)}
                </dd>
              </div>
              {invoice.withholdingAmount > 0 ? (
                <div className="flex justify-between py-1">
                  <dt className="text-slate-500">
                    PPh 23 ({invoice.withholdingRate}%)
                  </dt>
                  <dd className="text-slate-800">
                    -{formatMoney(invoice.withholdingAmount, invoice.currency)}
                  </dd>
                </div>
              ) : null}

              <div
                className="mt-2 flex items-center justify-between rounded-md px-3 py-2.5 text-white"
                style={{ backgroundColor: accent }}
              >
                <dt className="text-xs font-bold tracking-wider">TOTAL</dt>
                <dd className="text-base font-bold">
                  {formatMoney(invoice.total, invoice.currency)}
                </dd>
              </div>

              <div className="flex justify-between py-1.5">
                <dt className="text-slate-500">Sudah dibayar</dt>
                <dd className="text-slate-800">
                  {formatMoney(invoice.amountPaid, invoice.currency)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <dt className="font-semibold text-slate-700">Sisa tagihan</dt>
                <dd className="text-base font-semibold text-slate-900">
                  {formatMoney(invoice.balance, invoice.currency)}
                </dd>
              </div>
            </dl>
          </div>

          {schedules.length > 0 ? (
            <div className="mt-7">
              <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">
                JADWAL PEMBAYARAN
              </p>
              <ul className="mt-1.5 space-y-1 text-xs">
                {schedules.map((schedule) => (
                  <li key={schedule.id} className="flex justify-between">
                    <span className="text-slate-500">
                      {schedule.label} · jatuh tempo {formatDate(schedule.dueDate)}
                      {schedule.paidAt ? " · lunas" : ""}
                    </span>
                    <span className="text-slate-800">
                      {formatMoney(schedule.amount, invoice.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {payments.length > 0 ? (
            <div className="mt-7">
              <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">
                RIWAYAT PEMBAYARAN
              </p>
              <ul className="mt-1.5 space-y-1 text-xs">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between">
                    <span className="text-slate-500">
                      {formatDate(payment.paidAt)} · {payment.method}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </span>
                    <span className="text-slate-800">
                      {formatMoney(payment.amount, invoice.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {company.bankName || company.bankAccount ? (
              <div className="rounded-lg bg-slate-50 p-3.5">
                <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">
                  PEMBAYARAN KE
                </p>
                {company.bankName ? (
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {company.bankName}
                  </p>
                ) : null}
                {company.bankAccount ? (
                  <p className="text-sm text-slate-800">{company.bankAccount}</p>
                ) : null}
                {company.bankHolder ? (
                  <p className="text-xs text-slate-500">
                    a.n. {company.bankHolder}
                  </p>
                ) : null}
              </div>
            ) : null}

            {invoice.notes || invoice.terms ? (
              <div className="rounded-lg bg-slate-50 p-3.5">
                <p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">
                  CATATAN
                </p>
                {invoice.notes ? (
                  <p className="mt-1 text-xs whitespace-pre-wrap text-slate-700">
                    {invoice.notes}
                  </p>
                ) : null}
                {invoice.terms ? (
                  <p className="mt-1 text-xs whitespace-pre-wrap text-slate-500">
                    {invoice.terms}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="mt-8 border-t border-slate-100 pt-3 text-center text-[10px] text-slate-400">
            {company.name} · {invoice.number} · Terima kasih atas kerja samanya
          </p>
        </div>
      </div>
    </div>
  );
}
