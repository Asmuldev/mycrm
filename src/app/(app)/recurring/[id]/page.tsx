import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceStatusLabel, recurringFrequencyLabel } from "@/lib/labels";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteRecurring,
  runRecurringNow,
  skipNextRun,
  toggleRecurring,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function RecurringDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const template = await prisma.recurringInvoice.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      items: { orderBy: { position: "asc" } },
      invoices: {
        where: { deletedAt: null },
        orderBy: { issueDate: "desc" },
        take: 20,
      },
    },
  });
  if (!template) notFound();

  const perPeriod = template.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0,
  );

  const toggle = toggleRecurring.bind(null, template.id);
  const runNow = runRecurringNow.bind(null, template.id);
  const skip = skipNextRun.bind(null, template.id);
  const remove = deleteRecurring.bind(null, template.id);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={template.title}
        description={`${template.client.name} · ${recurringFrequencyLabel[template.frequency]}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/recurring/${template.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            {isAdmin(session) ? (
              <form action={remove}>
                <ConfirmButton message={`Hapus langganan "${template.title}"?`}>
                  Hapus
                </ConfirmButton>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <form action={runNow}>
          <SubmitButton pendingLabel="Membuat...">
            Terbitkan invoice sekarang
          </SubmitButton>
        </form>
        <form action={skip}>
          <SubmitButton variant="secondary" pendingLabel="...">
            Lewati periode ini
          </SubmitButton>
        </form>
        <form action={toggle}>
          <SubmitButton variant="secondary" pendingLabel="...">
            {template.active ? "Jeda langganan" : "Aktifkan langganan"}
          </SubmitButton>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Nilai per periode</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(perPeriod, template.currency)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Terbit berikutnya</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatDate(template.nextRunAt)}
          </p>
          <p className="text-xs text-slate-400">
            {template.autoSend ? "Dikirim otomatis" : "Dibuat sebagai draft"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Status</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {template.active ? "Aktif" : "Jeda"}
          </p>
          <p className="text-xs text-slate-400">
            {template.endDate
              ? `Berakhir ${formatDate(template.endDate)}`
              : "Tanpa tanggal berakhir"}
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Item template" />
        <ul className="divide-y divide-slate-100">
          {template.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <span className="text-sm text-slate-800">{item.description}</span>
              <span className="text-sm text-slate-600">
                {Number(item.quantity)} ×{" "}
                {formatMoney(item.unitPrice, template.currency)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Invoice yang sudah terbit" />
        {template.invoices.length === 0 ? (
          <EmptyState title="Belum ada invoice dari langganan ini" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {template.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="text-sm font-medium text-slate-800 hover:underline"
                  >
                    {invoice.number}
                  </Link>
                  <p className="text-xs text-slate-500">
                    Terbit {formatDate(invoice.issueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700">
                    {formatMoney(invoice.total, invoice.currency)}
                  </span>
                  <Badge
                    value={invoice.status}
                    label={invoiceStatusLabel[invoice.status]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
