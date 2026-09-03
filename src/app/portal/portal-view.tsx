import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceStatusLabel, serviceStatusLabel } from "@/lib/labels";
import { invoiceBalance } from "@/lib/money";
import { formatBytes } from "@/lib/services";
import type { getPortalData } from "@/lib/portal-data";

type PortalData = NonNullable<Awaited<ReturnType<typeof getPortalData>>>;

/**
 * The client-facing dashboard. Rendered identically whether the visitor arrived
 * through a portal link or a signed-in account; only `linkBase` differs, so the
 * two entry points cannot drift apart.
 */
export function PortalView({
  data,
  linkBase,
}: {
  data: PortalData;
  linkBase: string;
}) {
  const { profile, client, services, invoices, outstanding, advanceRemaining } =
    data;
  const accent = profile.accentColor;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5" style={{ backgroundColor: accent }} />
        <div className="px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logoUrl}
                  alt={profile.name}
                  className="mb-2 max-h-10 max-w-[150px] object-contain"
                />
              ) : null}
              <p className="text-sm font-semibold text-slate-900">
                {profile.name}
              </p>
              {profile.email ? (
                <p className="text-xs text-slate-500">{profile.email}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Portal tagihan</p>
              <p className="text-base font-semibold text-slate-900">
                {client.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total tagihan berjalan</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatMoney(outstanding, profile.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Saldo uang muka</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatMoney(advanceRemaining, profile.currency)}
          </p>
        </div>
      </div>

      {services.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Layanan Anda</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {services.map((service) => (
              <li
                key={service.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {service.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {service.domain ?? "-"}
                    {service.phpVersion ? ` · PHP ${service.phpVersion}` : ""}
                    {service.diskUsedBytes
                      ? ` · disk ${formatBytes(service.diskUsedBytes)}`
                      : ""}
                  </p>
                  {service.sslExpiresAt ? (
                    <p className="text-xs text-slate-500">
                      SSL berlaku sampai {formatDate(service.sslExpiresAt)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-700">
                    {serviceStatusLabel[service.status]}
                  </p>
                  <p className="text-xs text-slate-500">
                    {service.remoteRunning === null
                      ? ""
                      : service.remoteRunning
                        ? "berjalan"
                        : "berhenti"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Invoice Anda</h2>
        </div>
        {invoices.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Belum ada invoice.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {invoices.map((invoice) => {
              const balance = invoiceBalance(invoice);
              return (
                <li key={invoice.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`${linkBase}/invoices/${invoice.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {invoice.number}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Terbit {formatDate(invoice.issueDate)} · jatuh tempo{" "}
                        {formatDate(invoice.dueDate)} ·{" "}
                        {invoiceStatusLabel[invoice.status]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`${linkBase}/invoices/${invoice.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Lihat rincian
                    </Link>
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
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {profile.bankName || profile.bankAccount ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold tracking-[0.12em] text-slate-400">
            PEMBAYARAN KE
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {profile.bankName}
          </p>
          <p className="text-sm text-slate-800">{profile.bankAccount}</p>
          {profile.bankHolder ? (
            <p className="text-xs text-slate-500">a.n. {profile.bankHolder}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
