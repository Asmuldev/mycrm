import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { appTimeZone, inAppZone, startOfToday } from "@/lib/time";
import { Card, PageHeader, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

type CalendarItem = {
  id: string;
  day: string;
  label: string;
  href: string;
  tone: string;
};

function dayKey(value: Date) {
  const zoned = inAppZone(value);
  return `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, "0")}-${String(
    zoned.getDate(),
  ).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const today = startOfToday();
  const zonedToday = inAppZone(today);

  const [year, month] = (
    params.month ??
    `${zonedToday.getFullYear()}-${String(zonedToday.getMonth() + 1).padStart(2, "0")}`
  )
    .split("-")
    .map(Number);

  const safeYear = Number.isFinite(year) ? year! : zonedToday.getFullYear();
  const safeMonth = Number.isFinite(month) ? month! : zonedToday.getMonth() + 1;

  const from = new Date(Date.UTC(safeYear, safeMonth - 1, 1));
  const to = new Date(Date.UTC(safeYear, safeMonth, 1));

  const [tasks, invoices, quotes, recurring] = await Promise.all([
    prisma.task.findMany({
      where: { dueDate: { gte: from, lt: to } },
      include: { client: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { dueDate: { gte: from, lt: to }, status: { not: "CANCELLED" } },
      include: { client: { select: { name: true } } },
    }),
    prisma.quote.findMany({
      where: { validUntil: { gte: from, lt: to }, status: { in: ["DRAFT", "SENT"] } },
      include: { client: { select: { name: true } } },
    }),
    prisma.recurringInvoice.findMany({
      where: { active: true, nextRunAt: { gte: from, lt: to } },
    }),
  ]);

  const items: CalendarItem[] = [
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      day: dayKey(task.dueDate!),
      label: `Tugas: ${task.title}`,
      href: "/tasks",
      tone: task.status === "DONE" ? "bg-slate-100 text-slate-500" : "bg-sky-50 text-sky-800",
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      day: dayKey(invoice.dueDate),
      label: `${invoice.number} · ${formatMoney(invoice.total, invoice.currency)}`,
      href: `/invoices/${invoice.id}`,
      tone:
        invoice.status === "PAID"
          ? "bg-emerald-50 text-emerald-800"
          : "bg-rose-50 text-rose-800",
    })),
    ...quotes.map((quote) => ({
      id: `quote-${quote.id}`,
      day: dayKey(quote.validUntil),
      label: `Penawaran ${quote.number} berakhir`,
      href: `/quotes/${quote.id}`,
      tone: "bg-amber-50 text-amber-800",
    })),
    ...recurring.map((template) => ({
      id: `recurring-${template.id}`,
      day: dayKey(template.nextRunAt),
      label: `Langganan: ${template.title}`,
      href: `/recurring/${template.id}`,
      tone: "bg-violet-50 text-violet-700",
    })),
  ];

  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
  }

  const firstOfMonth = new Date(Date.UTC(safeYear, safeMonth - 1, 1));
  const daysInMonth = new Date(Date.UTC(safeYear, safeMonth, 0)).getUTCDate();
  // Monday-first grid, matching how Indonesian calendars are printed.
  const leadingBlanks = (firstOfMonth.getUTCDay() + 6) % 7;

  const prevMonth = new Date(Date.UTC(safeYear, safeMonth - 2, 1));
  const nextMonth = new Date(Date.UTC(safeYear, safeMonth, 1));
  const monthParam = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: appTimeZone(),
  }).format(new Date(Date.UTC(safeYear, safeMonth - 1, 15)));

  const todayKey = dayKey(today);

  return (
    <div>
      <PageHeader
        title="Kalender"
        description="Jatuh tempo invoice, deadline tugas, masa berlaku penawaran, dan jadwal langganan"
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/calendar?month=${monthParam(prevMonth)}`}
              className={buttonClass("secondary")}
            >
              Sebelumnya
            </Link>
            <Link href="/calendar" className={buttonClass("ghost")}>
              Bulan ini
            </Link>
            <Link
              href={`/calendar?month=${monthParam(nextMonth)}`}
              className={buttonClass("secondary")}
            >
              Berikutnya
            </Link>
          </div>
        }
      />

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{monthLabel}</h2>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} className="min-h-24 rounded-lg bg-slate-50" />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const dayNumber = index + 1;
            const key = `${safeYear}-${String(safeMonth).padStart(2, "0")}-${String(
              dayNumber,
            ).padStart(2, "0")}`;
            const dayItems = byDay.get(key) ?? [];
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`min-h-24 rounded-lg border p-1.5 ${
                  isToday
                    ? "border-slate-900 bg-white"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div
                  className={`mb-1 text-xs ${
                    isToday ? "font-bold text-slate-900" : "text-slate-500"
                  }`}
                >
                  {dayNumber}
                </div>
                <div className="space-y-1">
                  {dayItems.slice(0, 4).map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      title={item.label}
                      className={`block truncate rounded px-1.5 py-0.5 text-[10px] ${item.tone}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {dayItems.length > 4 ? (
                    <p className="px-1.5 text-[10px] text-slate-400">
                      +{dayItems.length - 4} lagi
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
