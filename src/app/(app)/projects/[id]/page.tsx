import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateInput, formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import {
  expenseCategoryLabel,
  invoiceStatusLabel,
  projectStatusLabel,
  taskStatusLabel,
} from "@/lib/labels";
import { invoiceBalance, toBaseAmount } from "@/lib/money";
import { formatHours, projectProfit, unbilledTimeValue } from "@/lib/projects";
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
import { CustomFieldsCard } from "@/components/custom-fields-card";
import { SubmitButton } from "@/components/submit-button";
import { deleteProject, deleteTimeEntry, invoiceProjectWork } from "../actions";
import { LogTimeCard } from "./time-card";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [project, profile] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
        timeEntries: {
          orderBy: { spentOn: "desc" },
          include: { user: { select: { name: true } } },
        },
        expenses: {
          where: { deletedAt: null },
          orderBy: { spentOn: "desc" },
        },
        tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
        invoices: { where: { deletedAt: null }, orderBy: { issueDate: "desc" } },
      },
    }),
    getCompanyProfile(),
  ]);
  if (!project || project.deletedAt) notFound();

  const base = profile.currency;
  const totalMinutes = project.timeEntries.reduce(
    (sum, entry) => sum + entry.minutes,
    0,
  );
  const unbilledValue = toBaseAmount(
    unbilledTimeValue(project.timeEntries),
    project.exchangeRate,
  );
  const unbilledExpenses = project.expenses
    .filter((expense) => expense.billable && !expense.invoiceId)
    .reduce(
      (sum, expense) => sum + toBaseAmount(expense.amount, expense.exchangeRate),
      0,
    );
  const invoicedBase = project.invoices
    .filter((invoice) => invoice.status !== "CANCELLED")
    .reduce(
      (sum, invoice) => sum + toBaseAmount(invoice.total, invoice.exchangeRate),
      0,
    );
  const profit = projectProfit({ invoicedBase, expenses: project.expenses });
  const budgetHours = project.budgetHours ? Number(project.budgetHours) : null;
  const hoursUsedPercent =
    budgetHours && budgetHours > 0
      ? Math.min((totalMinutes / 60 / budgetHours) * 100, 999)
      : null;

  const removeProject = deleteProject.bind(null, project.id);
  const billWork = invoiceProjectWork.bind(null, project.id);

  return (
    <div>
      <PageHeader
        title={project.name}
        description={`${project.client.name}${project.code ? ` · ${project.code}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/expenses/new?projectId=${project.id}&clientId=${project.client.id}`}
              variant="secondary"
            >
              + Biaya
            </LinkButton>
            <LinkButton href={`/projects/${project.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            {isAdmin(session) ? (
              <form action={removeProject}>
                <ConfirmButton message={`Hapus proyek "${project.name}"?`}>
                  Hapus
                </ConfirmButton>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Waktu tercatat</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {totalMinutes > 0 ? formatHours(totalMinutes) : "0 jam"}
          </p>
          {budgetHours ? (
            <p className="text-xs text-slate-400">
              dari {budgetHours} jam ({hoursUsedPercent?.toFixed(0)}%)
            </p>
          ) : null}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Belum ditagihkan</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(unbilledValue + unbilledExpenses, base)}
          </p>
          <p className="text-xs text-slate-400">waktu + biaya billable</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Sudah ditagihkan</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(invoicedBase, base)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Margin</p>
          <p
            className={`mt-1 text-lg font-semibold ${
              profit.margin < 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {formatMoney(profit.margin, base)}
          </p>
          <p className="text-xs text-slate-400">
            biaya {formatMoney(profit.costBase, base)} ·{" "}
            {profit.marginPercent.toFixed(0)}%
          </p>
        </Card>
      </div>

      {unbilledValue + unbilledExpenses > 0 ? (
        <form action={billWork} className="mt-4">
          <SubmitButton pendingLabel="Menyusun invoice...">
            Tagihkan pekerjaan yang belum ditagih
          </SubmitButton>
        </form>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Catatan waktu"
              description={`${project.timeEntries.length} entri`}
            />
            {project.timeEntries.length === 0 ? (
              <EmptyState title="Belum ada waktu tercatat" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {project.timeEntries.slice(0, 30).map((entry) => {
                  const remove = deleteTimeEntry.bind(null, project.id, entry.id);
                  return (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">
                          {entry.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(entry.spentOn)} · {formatHours(entry.minutes)}
                          {entry.user ? ` · ${entry.user.name}` : ""}
                          {entry.billable ? "" : " · tidak ditagihkan"}
                          {entry.invoiceId ? " · sudah ditagih" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm text-slate-700">
                          {entry.billable
                            ? formatMoney(
                                (entry.minutes / 60) * Number(entry.hourlyRate),
                                project.currency,
                              )
                            : "-"}
                        </span>
                        {entry.invoiceId ? null : (
                          <form action={remove}>
                            <ConfirmButton
                              message="Hapus entri waktu ini?"
                              variant="ghost"
                              className="px-2 py-1 text-xs text-rose-600"
                            >
                              Hapus
                            </ConfirmButton>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Biaya proyek"
              action={
                <LinkButton
                  href={`/expenses/new?projectId=${project.id}&clientId=${project.client.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  + Biaya
                </LinkButton>
              }
            />
            {project.expenses.length === 0 ? (
              <EmptyState title="Belum ada biaya" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {project.expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/expenses/${expense.id}`}
                        className="text-sm text-slate-800 hover:underline"
                      >
                        {expense.description}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {formatDate(expense.spentOn)} ·{" "}
                        {expenseCategoryLabel[expense.category] ?? expense.category}
                        {expense.billable ? " · billable" : ""}
                      </p>
                    </div>
                    <span className="text-sm text-slate-700">
                      {formatMoney(expense.amount, expense.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Invoice proyek" />
            {project.invoices.length === 0 ? (
              <EmptyState title="Belum ada invoice" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {project.invoices.map((invoice) => (
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
                        Sisa {formatMoney(invoiceBalance(invoice), invoice.currency)}
                      </p>
                    </div>
                    <Badge
                      value={invoice.status}
                      label={invoiceStatusLabel[invoice.status]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Detail" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Row label="Status">
                <Badge
                  value={project.status}
                  label={projectStatusLabel[project.status]}
                />
              </Row>
              <Row label="Klien">
                <Link href={`/clients/${project.client.id}`} className="underline">
                  {project.client.name}
                </Link>
              </Row>
              {project.deal ? (
                <Row label="Deal asal">
                  <Link href={`/deals/${project.deal.id}`} className="underline">
                    {project.deal.title}
                  </Link>
                </Row>
              ) : null}
              <Row label="Mulai">{formatDate(project.startDate)}</Row>
              <Row label="Target selesai">{formatDate(project.endDate)}</Row>
              <Row label="Tarif per jam">
                {formatMoney(project.hourlyRate, project.currency)}
              </Row>
              <Row label="Anggaran">
                {project.budgetAmount
                  ? formatMoney(project.budgetAmount, project.currency)
                  : "-"}
              </Row>
            </dl>
            {project.notes ? (
              <p className="border-t border-slate-100 px-5 py-3 text-sm whitespace-pre-wrap text-slate-600">
                {project.notes}
              </p>
            ) : null}
          </Card>

          <LogTimeCard
            projectId={project.id}
            defaultRate={Number(project.hourlyRate)}
            today={formatDateInput(new Date())}
            tasks={project.tasks
              .filter((task) => task.status !== "DONE")
              .map((task) => ({ id: task.id, title: task.title }))}
          />

          <CustomFieldsCard
            entity="PROJECT"
            entityId={project.id}
            revalidate={`/projects/${project.id}`}
          />

          <Card>
            <CardHeader
              title="Tugas proyek"
              action={
                <LinkButton
                  href={`/tasks?projectId=${project.id}`}
                  variant="secondary"
                  className="px-2 py-1 text-xs"
                >
                  Kelola
                </LinkButton>
              }
            />
            {project.tasks.length === 0 ? (
              <EmptyState title="Belum ada tugas" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {project.tasks.slice(0, 10).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <span className="text-sm text-slate-800">{task.title}</span>
                    <Badge
                      value={task.status}
                      label={taskStatusLabel[task.status]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
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
