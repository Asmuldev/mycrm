import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateInput, formatMoney } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { AttachmentsCard } from "@/components/attachments-card";
import { isAdmin } from "@/lib/permissions";
import { requireSession } from "@/lib/auth";
import { invoiceBalance } from "@/lib/money";
import { isPaymentGatewayConfigured } from "@/lib/payment";
import { CustomFieldsCard } from "@/components/custom-fields-card";
import { WhatsappButton } from "@/components/whatsapp-button";
import {
  buildInvoiceWhatsapp,
  pickWhatsappNumber,
} from "@/lib/whatsapp-message";
import { computeLateFee } from "@/lib/money";
import { startOfToday } from "@/lib/time";
import { getCompanyProfile } from "@/lib/invoice";
import { creditNoteStatusLabel } from "@/lib/labels";
import {
  addPayment,
  addSchedule,
  applyLateFee,
  clearLateFee,
  deleteInvoice,
  deletePayment,
  deleteSchedule,
  generatePaymentLink,
  saveWithholdingSlip,
  setInvoiceStatus,
  toggleSchedulePaid,
} from "../actions";
import { SendInvoiceCard } from "./send-card";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const profile = await getCompanyProfile();
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: {
        include: {
          contacts: { where: { isPrimary: true }, take: 1 },
        },
      },
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      schedules: { orderBy: { position: "asc" } },
      attachments: { orderBy: { createdAt: "desc" } },
      creditNotes: { orderBy: { issueDate: "desc" } },
      project: { select: { id: true, name: true } },
    },
  });
  if (!invoice || invoice.deletedAt) notFound();

  const balance = invoiceBalance(invoice);
  const removeInvoice = deleteInvoice.bind(null, invoice.id);
  const recordPayment = addPayment.bind(null, invoice.id);
  const markSent = setInvoiceStatus.bind(null, invoice.id, "SENT");
  const markPaid = setInvoiceStatus.bind(null, invoice.id, "PAID");
  const markDraft = setInvoiceStatus.bind(null, invoice.id, "DRAFT");
  const markCancelled = setInvoiceStatus.bind(null, invoice.id, "CANCELLED");
  const makePaymentLink = generatePaymentLink.bind(null, invoice.id);
  const createSchedule = addSchedule.bind(null, invoice.id);
  const saveSlip = saveWithholdingSlip.bind(null, invoice.id);
  const chargeLateFee = applyLateFee.bind(null, invoice.id);
  const removeLateFee = clearLateFee.bind(null, invoice.id);

  const waNumber = pickWhatsappNumber(
    invoice.client,
    invoice.client.contacts[0]?.phone,
    profile.waCountryCode,
  );
  const whatsapp = buildInvoiceWhatsapp({
    profile,
    clientName: invoice.client.name,
    number: invoice.number,
    total: invoice.total,
    balance,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paymentLinkUrl: invoice.paymentLinkUrl,
    phone: waNumber,
    // Once an invoice has gone out, the reminder wording fits better.
    reminder: invoice.status !== "DRAFT" && balance > 0 && invoice.sentAt !== null,
  });

  const pendingLateFee = profile.lateFeeEnabled
    ? computeLateFee({
        outstanding: balance,
        dueDate: new Date(invoice.dueDate),
        today: startOfToday(),
        percentPerMonth: Number(profile.lateFeePercent),
        graceDays: profile.lateFeeGraceDays,
      })
    : 0;

  return (
    <div>
      <PageHeader
        title={invoice.number}
        description={`${invoice.client.name} · ${invoiceStatusLabel[invoice.status]}`}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <WhatsappButton
              href={whatsapp.href}
              message={whatsapp.message}
              label="WhatsApp"
            />
            <LinkButton href={`/invoices/${invoice.id}/pdf`}>
              Unduh PDF
            </LinkButton>
            <LinkButton
              href={`/invoices/${invoice.id}/print`}
              variant="secondary"
            >
              Pratinjau / cetak
            </LinkButton>
            <LinkButton href={`/invoices/${invoice.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            {isAdmin(session) ? (
              <form action={removeInvoice}>
                <ConfirmButton message={`Hapus invoice ${invoice.number}?`}>
                  Hapus
                </ConfirmButton>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="no-print mb-4 flex flex-wrap gap-2">
        {invoice.status === "DRAFT" ? (
          <form action={markSent}>
            <SubmitButton variant="secondary">Tandai terkirim</SubmitButton>
          </form>
        ) : (
          <form action={markDraft}>
            <SubmitButton variant="secondary">Kembalikan ke draft</SubmitButton>
          </form>
        )}
        {invoice.status !== "PAID" ? (
          <form action={markPaid}>
            <SubmitButton variant="secondary">Tandai lunas</SubmitButton>
          </form>
        ) : null}
        {invoice.status !== "CANCELLED" ? (
          <form action={markCancelled}>
            <ConfirmButton
              message="Batalkan invoice ini?"
              variant="secondary"
            >
              Batalkan
            </ConfirmButton>
          </form>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Rincian" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-medium">Deskripsi</th>
                    <th className="px-5 py-2 text-right font-medium">Qty</th>
                    <th className="px-5 py-2 text-right font-medium">Harga</th>
                    <th className="px-5 py-2 text-right font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-2 text-slate-800">
                        {item.description}
                      </td>
                      <td className="px-5 py-2 text-right text-slate-600">
                        {Number(item.quantity)}
                      </td>
                      <td className="px-5 py-2 text-right text-slate-600">
                        {formatMoney(item.unitPrice, invoice.currency)}
                      </td>
                      <td className="px-5 py-2 text-right font-medium text-slate-800">
                        {formatMoney(item.amount, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm">
              <SummaryRow label="Subtotal">
                {formatMoney(invoice.subtotal, invoice.currency)}
              </SummaryRow>
              <SummaryRow label="Diskon">
                -{formatMoney(invoice.discount, invoice.currency)}
              </SummaryRow>
              <SummaryRow label={`PPN (${Number(invoice.taxRate)}%)`}>
                {formatMoney(invoice.taxAmount, invoice.currency)}
              </SummaryRow>
              {Number(invoice.withholdingAmount) > 0 ? (
                <SummaryRow
                  label={`PPh 23 (${Number(invoice.withholdingRate)}%)`}
                >
                  -{formatMoney(invoice.withholdingAmount, invoice.currency)}
                </SummaryRow>
              ) : null}
              {Number(invoice.lateFeeAmount) > 0 ? (
                <SummaryRow label="Denda keterlambatan">
                  {formatMoney(invoice.lateFeeAmount, invoice.currency)}
                </SummaryRow>
              ) : null}
              <SummaryRow label="Total" strong>
                {formatMoney(invoice.total, invoice.currency)}
              </SummaryRow>
              <SummaryRow label="Dibayar">
                {formatMoney(invoice.amountPaid, invoice.currency)}
              </SummaryRow>
              {Number(invoice.creditedAmount) > 0 ? (
                <SummaryRow label="Nota kredit">
                  -{formatMoney(invoice.creditedAmount, invoice.currency)}
                </SummaryRow>
              ) : null}
              <SummaryRow label="Sisa" strong>
                {formatMoney(balance, invoice.currency)}
              </SummaryRow>
            </dl>
            {invoice.notes || invoice.terms ? (
              <div className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
                {invoice.notes ? (
                  <p className="whitespace-pre-wrap">{invoice.notes}</p>
                ) : null}
                {invoice.terms ? (
                  <p className="whitespace-pre-wrap text-xs text-slate-500">
                    {invoice.terms}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <SendInvoiceCard
            invoiceId={invoice.id}
            clientEmail={invoice.client.email}
            sentAt={invoice.sentAt?.toISOString() ?? null}
          />

          <Card className="no-print">
            <CardHeader
              title="Termin pembayaran"
              description="Bagi tagihan jadi beberapa jatuh tempo"
            />
            {invoice.schedules.length === 0 ? (
              <EmptyState title="Belum ada termin" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {invoice.schedules.map((schedule) => {
                  const toggle = toggleSchedulePaid.bind(
                    null,
                    invoice.id,
                    schedule.id,
                  );
                  const remove = deleteSchedule.bind(
                    null,
                    invoice.id,
                    schedule.id,
                  );
                  return (
                    <li
                      key={schedule.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {schedule.label}
                        </p>
                        <p className="text-xs text-slate-500">
                          Jatuh tempo {formatDate(schedule.dueDate)}
                          {schedule.paidAt
                            ? ` · lunas ${formatDate(schedule.paidAt)}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-800">
                          {formatMoney(schedule.amount, invoice.currency)}
                        </span>
                        <form action={toggle}>
                          <SubmitButton
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                            pendingLabel="..."
                          >
                            {schedule.paidAt ? "Batal lunas" : "Tandai lunas"}
                          </SubmitButton>
                        </form>
                        <form action={remove}>
                          <ConfirmButton
                            message={`Hapus ${schedule.label}?`}
                            variant="ghost"
                            className="px-2 py-1 text-xs text-rose-600"
                          >
                            Hapus
                          </ConfirmButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <form
              action={createSchedule}
              className="grid grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-3"
            >
              <Field label="Label">
                <Input name="label" placeholder="Termin 1 (DP 50%)" />
              </Field>
              <Field label="Nominal">
                <Input name="amount" type="number" step="0.01" min="0" required />
              </Field>
              <Field label="Jatuh tempo">
                <Input
                  name="dueDate"
                  type="date"
                  defaultValue={formatDateInput(invoice.dueDate)}
                />
              </Field>
              <div className="sm:col-span-3">
                <SubmitButton variant="secondary">+ Tambah termin</SubmitButton>
              </div>
            </form>
          </Card>

          {Number(invoice.withholdingAmount) > 0 ? (
            <Card className="no-print">
              <CardHeader
                title="Bukti potong PPh 23"
                description={`Klien memotong ${formatMoney(invoice.withholdingAmount, invoice.currency)}. Catat bukti potongnya di sini untuk pelaporan pajak.`}
              />
              <form
                action={saveSlip}
                className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3"
              >
                <Field label="Nomor bukti potong" className="sm:col-span-2">
                  <Input
                    name="withholdingSlipNumber"
                    defaultValue={invoice.withholdingSlipNumber ?? ""}
                    placeholder="Kosongkan kalau belum diterima"
                  />
                </Field>
                <Field label="Tanggal bukti potong">
                  <Input
                    name="withholdingSlipDate"
                    type="date"
                    defaultValue={formatDateInput(invoice.withholdingSlipDate)}
                  />
                </Field>
                <div className="sm:col-span-3 flex items-center gap-3">
                  <SubmitButton variant="secondary">Simpan bukti potong</SubmitButton>
                  <span className="text-xs text-slate-500">
                    {invoice.withholdingSlipNumber
                      ? `Diterima ${formatDate(invoice.withholdingSlipDate)}`
                      : "Belum diterima"}
                  </span>
                </div>
              </form>
            </Card>
          ) : null}

          <Card className="no-print">
            <CardHeader
              title="Nota kredit"
              description="Koreksi resmi atas invoice yang sudah terkirim"
              action={
                <LinkButton
                  href={`/credit-notes/new?invoiceId=${invoice.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  + Nota kredit
                </LinkButton>
              }
            />
            {invoice.creditNotes.length === 0 ? (
              <EmptyState title="Belum ada nota kredit" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {invoice.creditNotes.map((note) => (
                  <li
                    key={note.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div>
                      <Link
                        href={`/credit-notes/${note.id}`}
                        className="text-sm font-medium text-slate-800 hover:underline"
                      >
                        {note.number}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {note.reason} · {formatDate(note.issueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-700">
                        {formatMoney(note.total, note.currency)}
                      </span>
                      <Badge
                        value={note.status}
                        label={creditNoteStatusLabel[note.status]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {profile.lateFeeEnabled ? (
            <Card className="no-print">
              <CardHeader
                title="Denda keterlambatan"
                description={`${Number(profile.lateFeePercent)}% per bulan setelah ${profile.lateFeeGraceDays} hari lewat tempo`}
              />
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                {Number(invoice.lateFeeAmount) > 0 ? (
                  <>
                    <span className="text-sm text-slate-700">
                      Terpasang{" "}
                      {formatMoney(invoice.lateFeeAmount, invoice.currency)}
                    </span>
                    <form action={removeLateFee}>
                      <SubmitButton
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        pendingLabel="..."
                      >
                        Hapus denda
                      </SubmitButton>
                    </form>
                  </>
                ) : pendingLateFee > 0 ? (
                  <>
                    <span className="text-sm text-slate-700">
                      Denda terhitung{" "}
                      {formatMoney(pendingLateFee, invoice.currency)}
                    </span>
                    <form action={chargeLateFee}>
                      <SubmitButton
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        pendingLabel="..."
                      >
                        Kenakan denda
                      </SubmitButton>
                    </form>
                  </>
                ) : (
                  <span className="text-sm text-slate-500">
                    Belum ada denda yang bisa dikenakan.
                  </span>
                )}
              </div>
            </Card>
          ) : null}

          <div className="no-print">
            <CustomFieldsCard
              entity="INVOICE"
              entityId={invoice.id}
              revalidate={`/invoices/${invoice.id}`}
            />
          </div>

          <AttachmentsCard
            invoiceId={invoice.id}
            revalidate={`/invoices/${invoice.id}`}
            attachments={invoice.attachments.map((attachment) => ({
              id: attachment.id,
              filename: attachment.filename,
              size: attachment.size,
              createdAt: attachment.createdAt.toISOString(),
            }))}
          />

          <Card className="no-print">
            <CardHeader title="Pembayaran" />
            <form
              action={recordPayment}
              className="grid grid-cols-1 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-2"
            >
              <Field label="Nominal">
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={balance > 0 ? balance.toFixed(2) : ""}
                />
              </Field>
              <Field label="Tanggal bayar">
                <Input
                  name="paidAt"
                  type="date"
                  defaultValue={formatDateInput(new Date())}
                />
              </Field>
              <Field label="Metode">
                <Select name="method" defaultValue="TRANSFER">
                  <option value="TRANSFER">Transfer bank</option>
                  <option value="CASH">Tunai</option>
                  <option value="CARD">Kartu</option>
                  <option value="EWALLET">E-wallet</option>
                  <option value="OTHER">Lainnya</option>
                </Select>
              </Field>
              <Field label="Referensi">
                <Input name="reference" placeholder="No. transaksi" />
              </Field>
              <div className="sm:col-span-2">
                <SubmitButton variant="secondary">
                  + Catat pembayaran
                </SubmitButton>
              </div>
            </form>
            {invoice.payments.length === 0 ? (
              <EmptyState title="Belum ada pembayaran" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {invoice.payments.map((payment) => {
                  const removePayment = deletePayment.bind(
                    null,
                    invoice.id,
                    payment.id,
                  );
                  return (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {formatMoney(payment.amount, invoice.currency)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(payment.paidAt)} · {payment.method}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                        </p>
                      </div>
                      <form action={removePayment}>
                        <ConfirmButton
                          message="Hapus pembayaran ini?"
                          variant="ghost"
                          className="px-2 py-1 text-xs text-rose-600"
                        >
                          Hapus
                        </ConfirmButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Info" />
          <dl className="space-y-3 px-5 py-4 text-sm">
            <SummaryRow label="Status">
              <Badge
                value={invoice.status}
                label={invoiceStatusLabel[invoice.status]}
              />
            </SummaryRow>
            <SummaryRow label="Klien">
              <Link
                href={`/clients/${invoice.client.id}`}
                className="underline"
              >
                {invoice.client.name}
              </Link>
            </SummaryRow>
            <SummaryRow label="Terbit">
              {formatDate(invoice.issueDate)}
            </SummaryRow>
            <SummaryRow label="Jatuh tempo">
              {formatDate(invoice.dueDate)}
            </SummaryRow>
            {invoice.project ? (
              <SummaryRow label="Proyek">
                <Link
                  href={`/projects/${invoice.project.id}`}
                  className="underline"
                >
                  {invoice.project.name}
                </Link>
              </SummaryRow>
            ) : null}
            <SummaryRow label="Mata uang">{invoice.currency}</SummaryRow>
          </dl>

          <div className="no-print border-t border-slate-100 px-5 py-4">
            <p className="mb-2 text-xs font-medium text-slate-600">
              Payment link
            </p>
            {invoice.paymentLinkUrl ? (
              <a
                href={invoice.paymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-xs text-slate-700 underline"
              >
                {invoice.paymentLinkUrl}
              </a>
            ) : (
              <p className="text-xs text-slate-500">
                {isPaymentGatewayConfigured()
                  ? "Belum dibuat."
                  : "Isi MIDTRANS_SERVER_KEY di .env untuk mengaktifkan."}
              </p>
            )}
            {isPaymentGatewayConfigured() && balance > 0 ? (
              <form action={makePaymentLink} className="mt-2">
                <SubmitButton
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                  pendingLabel="Membuat..."
                >
                  {invoice.paymentLinkUrl ? "Buat ulang link" : "Buat payment link"}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({
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
