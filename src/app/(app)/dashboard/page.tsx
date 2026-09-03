import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { invoiceStatusLabel, taskPriorityLabel } from "@/lib/labels";
import { getCompanyProfile, syncOverdueInvoices } from "@/lib/invoice";
import { invoiceBalance, toBaseAmount } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await syncOverdueInvoices();

  const profile = await getCompanyProfile();
  const base = profile.currency;

  const [
    clientCount,
    activeClients,
    openDeals,
    wonDeals,
    invoiceTotals,
    unpaidInvoices,
    overdueInvoices,
    upcomingTasks,
    recentActivities,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    // Summed in JS so each row converts with its own stored rate.
    prisma.deal.findMany({
      where: { stage: { notIn: ["WON", "LOST"] } },
      select: { value: true, exchangeRate: true },
    }),
    prisma.deal.findMany({
      where: { stage: "WON" },
      select: { value: true, exchangeRate: true },
    }),
    prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { total: true, amountPaid: true, exchangeRate: true },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.invoice.count({ where: { status: "OVERDUE" } }),
    prisma.task.findMany({
      where: { status: { not: "DONE" } },
      include: { client: { select: { name: true } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.activity.findMany({
      include: { client: { select: { id: true, name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 6,
    }),
  ]);

  const billed = invoiceTotals.reduce(
    (sum, invoice) => sum + toBaseAmount(invoice.total, invoice.exchangeRate),
    0,
  );
  const collected = invoiceTotals.reduce(
    (sum, invoice) => sum + toBaseAmount(invoice.amountPaid, invoice.exchangeRate),
    0,
  );
  const outstanding = Math.max(billed - collected, 0);
  const openPipeline = openDeals.reduce(
    (sum, deal) => sum + toBaseAmount(deal.value, deal.exchangeRate),
    0,
  );
  const wonPipeline = wonDeals.reduce(
    (sum, deal) => sum + toBaseAmount(deal.value, deal.exchangeRate),
    0,
  );

  const stats = [
    {
      label: "Klien",
      value: String(clientCount),
      hint: `${activeClients} aktif`,
      href: "/clients",
    },
    {
      label: "Pipeline terbuka",
      value: formatMoney(openPipeline, base),
      hint: `${openDeals.length} deal berjalan`,
      href: "/deals",
    },
    {
      label: "Deal menang",
      value: formatMoney(wonPipeline, base),
      hint: `${wonDeals.length} deal`,
      href: "/deals",
    },
    {
      label: "Piutang",
      value: formatMoney(outstanding, base),
      hint: `${overdueInvoices} invoice jatuh tempo`,
      href: "/invoices",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Ringkasan klien, pipeline, dan tagihan"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="p-4 transition hover:border-slate-300 hover:shadow">
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-400">{stat.hint}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Invoice belum lunas"
            description="Diurutkan dari jatuh tempo terdekat"
          />
          {unpaidInvoices.length === 0 ? (
            <EmptyState title="Semua invoice lunas" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {unpaidInvoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {invoice.number}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {invoice.client.name} · jatuh tempo{" "}
                        {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-slate-800">
                        {formatMoney(
                          invoiceBalance(invoice),
                          invoice.currency,
                        )}
                      </span>
                      <Badge
                        value={invoice.status}
                        label={invoiceStatusLabel[invoice.status]}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Tugas mendatang" description="Belum selesai" />
          {upcomingTasks.length === 0 ? (
            <EmptyState title="Tidak ada tugas terbuka" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {task.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {task.client?.name ?? "Tanpa klien"} ·{" "}
                      {task.dueDate ? formatDate(task.dueDate) : "tanpa deadline"}
                    </p>
                  </div>
                  <Badge
                    value={task.priority}
                    label={taskPriorityLabel[task.priority]}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Aktivitas terbaru" />
        {recentActivities.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas"
            description="Catatan, telepon, dan meeting akan muncul di sini."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentActivities.map((activity) => (
              <li key={activity.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-800">
                    {activity.subject ?? activity.content.slice(0, 60)}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatDate(activity.occurredAt)}
                  </span>
                </div>
                {activity.client ? (
                  <Link
                    href={`/clients/${activity.client.id}`}
                    className="text-xs text-slate-500 underline"
                  >
                    {activity.client.name}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-6 text-xs text-slate-400">
        Total tertagih {formatMoney(billed, base)} · terkumpul{" "}
        {formatMoney(collected, base)}
      </p>
    </div>
  );
}
