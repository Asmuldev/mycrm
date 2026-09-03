import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { recurringFrequencyLabel } from "@/lib/labels";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const templates = await prisma.recurringInvoice.findMany({
    include: {
      client: { select: { id: true, name: true } },
      items: true,
      _count: { select: { invoices: { where: { deletedAt: null } } } },
    },
    orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Langganan"
        description="Invoice berulang untuk klien retainer"
        action={<LinkButton href="/recurring/new">+ Langganan baru</LinkButton>}
      />

      <Card>
        {templates.length === 0 ? (
          <EmptyState
            title="Belum ada langganan"
            description="Buat template invoice yang terbit otomatis tiap periode."
            action={
              <LinkButton href="/recurring/new" className="mt-2">
                Buat langganan
              </LinkButton>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {templates.map((template) => {
              const perPeriod = template.items.reduce(
                (sum, item) =>
                  sum + Number(item.quantity) * Number(item.unitPrice),
                0,
              );
              return (
                <li
                  key={template.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/recurring/${template.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      {template.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {template.client.name} ·{" "}
                      {recurringFrequencyLabel[template.frequency]}
                      {template.interval > 1 ? ` ×${template.interval}` : ""} ·{" "}
                      {template._count.invoices} invoice terbit
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {formatMoney(perPeriod, template.currency)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Berikutnya {formatDate(template.nextRunAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        template.active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                      }`}
                    >
                      {template.active ? "Aktif" : "Jeda"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
