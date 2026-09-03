import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { expenseCategoryLabel } from "@/lib/labels";
import { toBaseAmount } from "@/lib/money";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import {
  Card,
  CardHeader,
  LinkButton,
  PageHeader,
} from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { AttachmentsCard } from "@/components/attachments-card";
import { deleteExpense } from "../actions";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [expense, profile] = await Promise.all([
    prisma.expense.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        createdBy: { select: { name: true } },
        attachments: { orderBy: { createdAt: "desc" } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!expense || expense.deletedAt) notFound();

  const remove = deleteExpense.bind(null, expense.id);
  const base = toBaseAmount(expense.amount, expense.exchangeRate);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={expense.description}
        description={`${formatDate(expense.spentOn)} · ${
          expenseCategoryLabel[expense.category] ?? expense.category
        }`}
        action={
          <div className="flex flex-wrap gap-2">
            {expense.invoiceId ? null : (
              <LinkButton
                href={`/expenses/${expense.id}/edit`}
                variant="secondary"
              >
                Edit
              </LinkButton>
            )}
            {isAdmin(session) ? (
              <ActionButton
                action={remove}
                message={`Hapus biaya "${expense.description}"?`}
              >
                Hapus
              </ActionButton>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader title="Detail" />
        <dl className="space-y-3 px-5 py-4 text-sm">
          <Row label="Nominal">
            <span className="font-medium">
              {formatMoney(expense.amount, expense.currency)}
            </span>
            {expense.currency !== profile.currency ? (
              <span className="ml-2 text-xs text-slate-500">
                ≈ {formatMoney(base, profile.currency)}
              </span>
            ) : null}
          </Row>
          <Row label="Vendor">{expense.vendor ?? "-"}</Row>
          <Row label="Klien">
            {expense.client ? (
              <Link href={`/clients/${expense.client.id}`} className="underline">
                {expense.client.name}
              </Link>
            ) : (
              "Biaya umum"
            )}
          </Row>
          <Row label="Proyek">
            {expense.project ? (
              <Link href={`/projects/${expense.project.id}`} className="underline">
                {expense.project.name}
              </Link>
            ) : (
              "-"
            )}
          </Row>
          <Row label="Tagih ulang">
            {expense.billable ? "Ya" : "Tidak"}
          </Row>
          <Row label="Status tagih">
            {expense.invoice ? (
              <Link
                href={`/invoices/${expense.invoice.id}`}
                className="underline"
              >
                Sudah ditagih di {expense.invoice.number}
              </Link>
            ) : expense.billable ? (
              "Belum ditagihkan"
            ) : (
              "-"
            )}
          </Row>
          <Row label="Dicatat oleh">{expense.createdBy?.name ?? "-"}</Row>
        </dl>
        {expense.notes ? (
          <p className="border-t border-slate-100 px-5 py-3 text-sm whitespace-pre-wrap text-slate-600">
            {expense.notes}
          </p>
        ) : null}
      </Card>

      <div className="mt-4">
        <AttachmentsCard
          expenseId={expense.id}
          revalidate={`/expenses/${expense.id}`}
          attachments={expense.attachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.filename,
            size: attachment.size,
            createdAt: attachment.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-800">{children}</dd>
    </div>
  );
}
