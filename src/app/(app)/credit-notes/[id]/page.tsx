import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { creditNoteStatusLabel } from "@/lib/labels";
import { invoiceBalance } from "@/lib/money";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { cancelCreditNote, deleteCreditNote, issueCreditNote } from "../actions";

export const dynamic = "force-dynamic";

export default async function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const note = await prisma.creditNote.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      invoice: {
        select: {
          id: true,
          number: true,
          total: true,
          amountPaid: true,
          creditedAmount: true,
          currency: true,
        },
      },
      items: { orderBy: { position: "asc" } },
    },
  });
  if (!note) notFound();

  const issue = issueCreditNote.bind(null, note.id);
  const cancel = cancelCreditNote.bind(null, note.id);
  const remove = deleteCreditNote.bind(null, note.id);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={note.number}
        description={`Koreksi atas ${note.invoice.number} · ${note.client.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            {note.status === "DRAFT" ? (
              <form action={issue}>
                <SubmitButton pendingLabel="Menerbitkan...">
                  Terbitkan
                </SubmitButton>
              </form>
            ) : null}
            {note.status === "ISSUED" ? (
              <form action={cancel}>
                <ConfirmButton
                  message="Batalkan nota kredit ini? Sisa tagihan invoice akan kembali."
                  variant="secondary"
                >
                  Batalkan
                </ConfirmButton>
              </form>
            ) : null}
            {isAdmin(session) ? (
              <ActionButton
                action={remove}
                message={`Hapus draft ${note.number}?`}
              >
                Hapus
              </ActionButton>
            ) : null}
          </div>
        }
      />

      {note.status === "DRAFT" ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Draft belum mengurangi tagihan. Terbitkan kalau koreksinya sudah benar.
        </p>
      ) : null}

      <Card>
        <CardHeader title="Rincian koreksi" description={note.reason} />
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
              {note.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-2 text-slate-800">{item.description}</td>
                  <td className="px-5 py-2 text-right text-slate-600">
                    {Number(item.quantity)}
                  </td>
                  <td className="px-5 py-2 text-right text-slate-600">
                    {formatMoney(item.unitPrice, note.currency)}
                  </td>
                  <td className="px-5 py-2 text-right font-medium text-slate-800">
                    {formatMoney(item.amount, note.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm">
          <Row label="Subtotal">
            {formatMoney(note.subtotal, note.currency)}
          </Row>
          <Row label={`PPN (${Number(note.taxRate)}%)`}>
            {formatMoney(note.taxAmount, note.currency)}
          </Row>
          <Row label="Total dikreditkan" strong>
            {formatMoney(note.total, note.currency)}
          </Row>
        </dl>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Dampak ke invoice" />
        <dl className="space-y-2 px-5 py-4 text-sm">
          <Row label="Invoice">
            <Link
              href={`/invoices/${note.invoice.id}`}
              className="underline"
            >
              {note.invoice.number}
            </Link>
          </Row>
          <Row label="Total invoice">
            {formatMoney(note.invoice.total, note.invoice.currency)}
          </Row>
          <Row label="Sudah dibayar">
            {formatMoney(note.invoice.amountPaid, note.invoice.currency)}
          </Row>
          <Row label="Total dikreditkan">
            {formatMoney(note.invoice.creditedAmount, note.invoice.currency)}
          </Row>
          <Row label="Sisa tagihan" strong>
            {formatMoney(invoiceBalance(note.invoice), note.invoice.currency)}
          </Row>
          <Row label="Status nota">
            <Badge
              value={note.status}
              label={creditNoteStatusLabel[note.status]}
            />
          </Row>
          <Row label="Tanggal">{formatDate(note.issueDate)}</Row>
        </dl>
        {note.notes ? (
          <p className="border-t border-slate-100 px-5 py-3 text-sm whitespace-pre-wrap text-slate-600">
            {note.notes}
          </p>
        ) : null}
      </Card>
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
