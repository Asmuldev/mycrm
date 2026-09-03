import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { invoiceStatusLabel } from "@/lib/labels";
import { invoiceBalance } from "@/lib/money";
import { resolvePortalToken, touchPortalToken } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portal = await resolvePortalToken(token);
  if (!portal) notFound();

  await touchPortalToken(portal.id);

  const [profile, invoices, credits] = await Promise.all([
    getCompanyProfile(),
    prisma.invoice.findMany({
      where: {
        clientId: portal.clientId,
        // Drafts are internal; the client only sees what was actually issued.
        status: { notIn: ["DRAFT", "CANCELLED"] },
      },
      orderBy: { issueDate: "desc" },
      take: 100,
    }),
    prisma.clientCredit.findMany({
      where: { clientId: portal.clientId, remaining: { gt: 0 } },
    }),
  ]);

  const outstanding = invoices.reduce(
    (sum, invoice) => sum + Math.max(invoiceBalance(invoice), 0),
    0,
  );
  const advanceRemaining = credits.reduce(
    (sum, credit) => sum + Number(credit.remaining),
    0,
  );
  const accent = profile.accentColor;

  return (
    <div className="force-light min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
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
                  {portal.client.name}
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
                        <p className="text-sm font-medium text-slate-900">
                          {invoice.number}
                        </p>
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
                      <a
                        href={`/portal/${token}/invoices/${invoice.id}/pdf`}
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

        <p className="mt-6 text-center text-xs text-slate-400">
          Tautan ini pribadi. Jangan dibagikan ke pihak lain.
        </p>
      </div>
    </div>
  );
}
