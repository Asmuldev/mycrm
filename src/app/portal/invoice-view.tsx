import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import { invoiceBalance } from "@/lib/money";
import type { getPortalInvoice } from "@/lib/portal-data";
import { PaymentProofForm } from "./proof-form";

type PortalInvoice = NonNullable<Awaited<ReturnType<typeof getPortalInvoice>>>;

export function PortalInvoiceView({
  invoice,
  linkBase,
  token,
  accent,
  bank,
}: {
  invoice: PortalInvoice;
  linkBase: string;
  token: string | null;
  accent: string;
  bank: { name: string | null; account: string | null; holder: string | null };
}) {
  const balance = invoiceBalance(invoice);

  return (
    <>
      <Link
        href={linkBase}
        className="mb-4 inline-block text-xs text-slate-500 hover:underline"
      >
        ← Kembali ke daftar
      </Link>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-1.5" style={{ backgroundColor: accent }} />
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {invoice.number}
            </h1>
            <p className="text-xs text-slate-500">
              Terbit {formatDate(invoice.issueDate)} · jatuh tempo{" "}
              {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">
              {invoiceStatusLabel[invoice.status]}
            </p>
            <p className="text-xl font-semibold text-slate-900">
              {formatMoney(invoice.total, invoice.currency)}
            </p>
            {balance > 0 ? (
              <p className="text-xs text-slate-500">
                Sisa {formatMoney(balance, invoice.currency)}
              </p>
            ) : (
              <p className="text-xs text-emerald-700">Lunas</p>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-2 font-medium">Deskripsi</th>
              <th className="px-6 py-2 text-right font-medium">Qty</th>
              <th className="px-6 py-2 text-right font-medium">Harga</th>
              <th className="px-6 py-2 text-right font-medium">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-2 text-slate-800">{item.description}</td>
                <td className="px-6 py-2 text-right text-slate-600">
                  {Number(item.quantity)}
                </td>
                <td className="px-6 py-2 text-right text-slate-600">
                  {formatMoney(item.unitPrice, invoice.currency)}
                </td>
                <td className="px-6 py-2 text-right font-medium text-slate-800">
                  {formatMoney(item.amount, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="space-y-1 border-t border-slate-100 px-6 py-4 text-sm">
          <Row label="Subtotal">
            {formatMoney(invoice.subtotal, invoice.currency)}
          </Row>
          {Number(invoice.discount) > 0 ? (
            <Row label="Diskon">
              -{formatMoney(invoice.discount, invoice.currency)}
            </Row>
          ) : null}
          <Row label={`PPN (${Number(invoice.taxRate)}%)`}>
            {formatMoney(invoice.taxAmount, invoice.currency)}
          </Row>
          {Number(invoice.withholdingAmount) > 0 ? (
            <Row label={`PPh 23 (${Number(invoice.withholdingRate)}%)`}>
              -{formatMoney(invoice.withholdingAmount, invoice.currency)}
            </Row>
          ) : null}
          {Number(invoice.lateFeeAmount) > 0 ? (
            <Row label="Denda keterlambatan">
              {formatMoney(invoice.lateFeeAmount, invoice.currency)}
            </Row>
          ) : null}
          <Row label="Total" strong>
            {formatMoney(invoice.total, invoice.currency)}
          </Row>
          <Row label="Sudah dibayar">
            {formatMoney(invoice.amountPaid, invoice.currency)}
          </Row>
          {Number(invoice.creditedAmount) > 0 ? (
            <Row label="Nota kredit">
              -{formatMoney(invoice.creditedAmount, invoice.currency)}
            </Row>
          ) : null}
          <Row label="Sisa tagihan" strong>
            {formatMoney(balance, invoice.currency)}
          </Row>
        </dl>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-6 py-4">
          <a
            href={`${linkBase}/invoices/${invoice.id}/pdf`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Unduh PDF
          </a>
          {invoice.paymentLinkUrl && balance > 0 ? (
            <a
              href={invoice.paymentLinkUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
              style={{ backgroundColor: accent }}
            >
              Bayar sekarang
            </a>
          ) : null}
        </div>
      </div>

      {invoice.schedules.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Jadwal pembayaran
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {invoice.schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <p className="text-slate-800">{schedule.label}</p>
                  <p className="text-xs text-slate-500">
                    Jatuh tempo {formatDate(schedule.dueDate)}
                    {schedule.paidAt ? " · lunas" : ""}
                  </p>
                </div>
                <span className="text-slate-700">
                  {formatMoney(schedule.amount, invoice.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Riwayat pembayaran
          </h2>
        </div>
        {invoice.payments.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-500">
            Belum ada pembayaran tercatat.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invoice.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <p className="text-slate-800">
                    {formatMoney(payment.amount, invoice.currency)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(payment.paidAt)} · {payment.method}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {balance > 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            Sudah transfer?
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Kirim buktinya di sini supaya kami bisa mencocokkan lebih cepat.
            {bank.name || bank.account
              ? ` Rekening: ${[bank.name, bank.account, bank.holder ? `a.n. ${bank.holder}` : null].filter(Boolean).join(" · ")}`
              : ""}
          </p>
          <PaymentProofForm
            invoiceId={invoice.id}
            token={token}
            accent={accent}
          />
          {invoice.attachments.length > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {invoice.attachments.length} bukti sudah Anda kirim.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={
          strong
            ? "text-sm font-semibold text-slate-900"
            : "text-sm text-slate-700"
        }
      >
        {children}
      </dd>
    </div>
  );
}
