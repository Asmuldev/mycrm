import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { quoteStatusLabel } from "@/lib/labels";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  Badge,
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { WhatsappButton } from "@/components/whatsapp-button";
import { getCompanyProfile } from "@/lib/invoice";
import {
  buildQuoteWhatsapp,
  pickWhatsappNumber,
} from "@/lib/whatsapp-message";
import { SubmitButton } from "@/components/submit-button";
import {
  convertQuoteToInvoice,
  deleteQuote,
  setQuoteStatus,
} from "../actions";
import { SendQuoteCard } from "./send-card";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: {
        include: { contacts: { where: { isPrimary: true }, take: 1 } },
      },
      deal: { select: { id: true, title: true } },
      items: { orderBy: { position: "asc" } },
      invoice: { select: { id: true, number: true } },
    },
  });
  if (!quote || quote.deletedAt) notFound();

  const profile = await getCompanyProfile();
  const whatsapp = buildQuoteWhatsapp({
    profile,
    clientName: quote.client.name,
    number: quote.number,
    total: quote.total,
    currency: quote.currency,
    validUntil: quote.validUntil,
    phone: pickWhatsappNumber(
      quote.client,
      quote.client.contacts[0]?.phone,
      profile.waCountryCode,
    ),
  });

  const convert = convertQuoteToInvoice.bind(null, quote.id);
  const accept = setQuoteStatus.bind(null, quote.id, "ACCEPTED");
  const reject = setQuoteStatus.bind(null, quote.id, "REJECTED");
  const remove = deleteQuote.bind(null, quote.id);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={quote.number}
        description={`${quote.client.name} · ${quoteStatusLabel[quote.status]}`}
        action={
          <div className="flex flex-wrap gap-2">
            <WhatsappButton
              href={whatsapp.href}
              message={whatsapp.message}
              label="WhatsApp"
            />
            <LinkButton href={`/quotes/${quote.id}/pdf`}>Unduh PDF</LinkButton>
            <LinkButton href={`/quotes/${quote.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            {isAdmin(session) ? (
              <form action={remove}>
                <ConfirmButton message={`Hapus penawaran ${quote.number}?`}>
                  Hapus
                </ConfirmButton>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {quote.invoice ? (
          <LinkButton href={`/invoices/${quote.invoice.id}`} variant="secondary">
            Lihat invoice {quote.invoice.number}
          </LinkButton>
        ) : (
          <form action={convert}>
            <SubmitButton pendingLabel="Mengonversi...">
              Konversi jadi invoice
            </SubmitButton>
          </form>
        )}
        {quote.status !== "ACCEPTED" ? (
          <form action={accept}>
            <SubmitButton variant="secondary" pendingLabel="...">
              Tandai diterima
            </SubmitButton>
          </form>
        ) : null}
        {quote.status !== "REJECTED" ? (
          <form action={reject}>
            <SubmitButton variant="secondary" pendingLabel="...">
              Tandai ditolak
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Rincian" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Deskripsi</th>
                    <th className="px-5 py-2 text-right font-medium">Qty</th>
                    <th className="px-5 py-2 text-right font-medium">Harga</th>
                    <th className="px-5 py-2 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-2 text-slate-800">
                        {item.description}
                      </td>
                      <td className="px-5 py-2 text-right text-slate-600">
                        {Number(item.quantity)}
                      </td>
                      <td className="px-5 py-2 text-right text-slate-600">
                        {formatMoney(item.unitPrice, quote.currency)}
                      </td>
                      <td className="px-5 py-2 text-right font-medium text-slate-800">
                        {formatMoney(item.amount, quote.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm">
              <Row label="Subtotal">
                {formatMoney(quote.subtotal, quote.currency)}
              </Row>
              <Row label="Diskon">
                -{formatMoney(quote.discount, quote.currency)}
              </Row>
              <Row label={`PPN (${Number(quote.taxRate)}%)`}>
                {formatMoney(quote.taxAmount, quote.currency)}
              </Row>
              <Row label="Total" strong>
                {formatMoney(quote.total, quote.currency)}
              </Row>
            </dl>
            {quote.notes || quote.terms ? (
              <div className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
                {quote.notes ? (
                  <p className="whitespace-pre-wrap">{quote.notes}</p>
                ) : null}
                {quote.terms ? (
                  <p className="whitespace-pre-wrap text-xs text-slate-500">
                    {quote.terms}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <SendQuoteCard
            quoteId={quote.id}
            clientEmail={quote.client.email}
            sentAt={quote.sentAt?.toISOString() ?? null}
          />
        </div>

        <Card className="h-fit">
          <CardHeader title="Info" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            <Row label="Status">
              <Badge
                value={quote.status}
                label={quoteStatusLabel[quote.status]}
              />
            </Row>
            <Row label="Klien">
              <Link href={`/clients/${quote.client.id}`} className="underline">
                {quote.client.name}
              </Link>
            </Row>
            {quote.deal ? (
              <Row label="Deal">
                <Link href={`/deals/${quote.deal.id}`} className="underline">
                  {quote.deal.title}
                </Link>
              </Row>
            ) : null}
            <Row label="Terbit">{formatDate(quote.issueDate)}</Row>
            <Row label="Berlaku sampai">{formatDate(quote.validUntil)}</Row>
            <Row label="Mata uang">{quote.currency}</Row>
          </dl>
        </Card>
      </div>
    </div>
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
