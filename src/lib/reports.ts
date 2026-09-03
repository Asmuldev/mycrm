import { invoiceBalance, toBaseAmount } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { calendarDaysBetween, startOfToday } from "@/lib/time";

export type MonthlyRevenue = {
  month: string;
  label: string;
  billed: number;
  collected: number;
};

/** Billed vs collected for the last `months` calendar months, oldest first. */
export async function monthlyRevenue(months = 12): Promise<MonthlyRevenue[]> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { not: "CANCELLED" },
        deletedAt: null,
        issueDate: { gte: start },
      },
      select: { issueDate: true, total: true, exchangeRate: true },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: start }, invoice: { deletedAt: null } },
      select: {
        paidAt: true,
        amount: true,
        invoice: { select: { exchangeRate: true } },
      },
    }),
  ]);

  const buckets = new Map<string, MonthlyRevenue>();
  for (let index = 0; index < months; index += 1) {
    const cursor = new Date(start);
    cursor.setMonth(start.getMonth() + index);
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      month: key,
      label: cursor.toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
      billed: 0,
      collected: 0,
    });
  }

  const keyOf = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  for (const invoice of invoices) {
    const bucket = buckets.get(keyOf(invoice.issueDate));
    if (bucket) bucket.billed += toBaseAmount(invoice.total, invoice.exchangeRate);
  }
  for (const payment of payments) {
    const bucket = buckets.get(keyOf(payment.paidAt));
    if (bucket) {
      bucket.collected += toBaseAmount(
        payment.amount,
        payment.invoice.exchangeRate,
      );
    }
  }

  return [...buckets.values()];
}

export type AgingBucket = {
  label: string;
  amount: number;
  count: number;
};

/** Splits outstanding receivables into standard aging windows. */
export async function receivableAging(): Promise<AgingBucket[]> {
  const today = startOfToday();
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, deletedAt: null },
    select: { dueDate: true, total: true, amountPaid: true, exchangeRate: true },
  });

  const buckets: AgingBucket[] = [
    { label: "Belum jatuh tempo", amount: 0, count: 0 },
    { label: "1–30 hari", amount: 0, count: 0 },
    { label: "31–60 hari", amount: 0, count: 0 },
    { label: "61–90 hari", amount: 0, count: 0 },
    { label: "> 90 hari", amount: 0, count: 0 },
  ];

  for (const invoice of invoices) {
    const balance = toBaseAmount(
      invoiceBalance(invoice),
      invoice.exchangeRate,
    );
    if (balance <= 0) continue;

    const days = calendarDaysBetween(new Date(invoice.dueDate), today);
    const index =
      days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    buckets[index]!.amount += balance;
    buckets[index]!.count += 1;
  }

  return buckets;
}

export async function topClients(limit = 10) {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    include: {
      invoices: {
        where: { status: { not: "CANCELLED" }, deletedAt: null },
        select: { total: true, amountPaid: true, exchangeRate: true },
      },
    },
  });

  return clients
    .map((client) => {
      const billed = client.invoices.reduce(
        (sum, invoice) => sum + toBaseAmount(invoice.total, invoice.exchangeRate),
        0,
      );
      const collected = client.invoices.reduce(
        (sum, invoice) =>
          sum + toBaseAmount(invoice.amountPaid, invoice.exchangeRate),
        0,
      );
      return {
        id: client.id,
        name: client.name,
        invoices: client.invoices.length,
        billed,
        collected,
        outstanding: billed - collected,
      };
    })
    .filter((row) => row.billed > 0)
    .sort((a, b) => b.billed - a.billed)
    .slice(0, limit);
}

export async function pipelineSummary() {
  // Grouped in JS because each deal must be converted with its own rate.
  const deals = await prisma.deal.findMany({
    where: { deletedAt: null },
    select: { stage: true, value: true, exchangeRate: true },
  });

  const byStage = new Map<string, { stage: string; count: number; value: number }>();
  for (const deal of deals) {
    const row = byStage.get(deal.stage) ?? {
      stage: deal.stage,
      count: 0,
      value: 0,
    };
    row.count += 1;
    row.value += toBaseAmount(deal.value, deal.exchangeRate);
    byStage.set(deal.stage, row);
  }

  const won = byStage.get("WON");
  const lost = byStage.get("LOST");
  const closed = (won?.count ?? 0) + (lost?.count ?? 0);

  return {
    byStage: [...byStage.values()],
    winRate: closed > 0 ? ((won?.count ?? 0) / closed) * 100 : 0,
    wonValue: won?.value ?? 0,
  };
}

export type CashflowBucket = {
  label: string;
  inflow: number;
  overdue: boolean;
};

/**
 * Expected collections grouped by how far away the due date is. Overdue money
 * is shown separately because it is owed now, not "in 30 days".
 */
export async function cashflowProjection() {
  const today = startOfToday();
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
    select: {
      dueDate: true,
      total: true,
      amountPaid: true,
      creditedAmount: true,
      exchangeRate: true,
    },
  });

  const buckets: CashflowBucket[] = [
    { label: "Lewat jatuh tempo", inflow: 0, overdue: true },
    { label: "0–30 hari", inflow: 0, overdue: false },
    { label: "31–60 hari", inflow: 0, overdue: false },
    { label: "61–90 hari", inflow: 0, overdue: false },
    { label: "> 90 hari", inflow: 0, overdue: false },
  ];

  for (const invoice of invoices) {
    const balance = toBaseAmount(invoiceBalance(invoice), invoice.exchangeRate);
    if (balance <= 0) continue;

    const days = calendarDaysBetween(today, new Date(invoice.dueDate));
    const index =
      days < 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
    buckets[index]!.inflow += balance;
  }

  return buckets;
}

/** Revenue minus recorded costs per month, in the base currency. */
export async function monthlyProfit(months = 12) {
  const revenue = await monthlyRevenue(months);

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - (months - 1));

  const expenses = await prisma.expense.findMany({
    where: { spentOn: { gte: start } },
    select: { spentOn: true, amount: true, exchangeRate: true },
  });

  const costByMonth = new Map<string, number>();
  for (const expense of expenses) {
    const key = `${expense.spentOn.getFullYear()}-${String(
      expense.spentOn.getMonth() + 1,
    ).padStart(2, "0")}`;
    costByMonth.set(
      key,
      (costByMonth.get(key) ?? 0) +
        toBaseAmount(expense.amount, expense.exchangeRate),
    );
  }

  return revenue.map((row) => {
    const cost = costByMonth.get(row.month) ?? 0;
    return { ...row, cost, profit: row.billed - cost };
  });
}

/** Billed, collected, and cost per client so margin is visible per account. */
export async function clientProfitability(limit = 10) {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    include: {
      invoices: {
        where: { status: { not: "CANCELLED" }, deletedAt: null },
        select: { total: true, exchangeRate: true },
      },
      expenses: {
        where: { deletedAt: null },
        select: { amount: true, exchangeRate: true },
      },
    },
  });

  return clients
    .map((client) => {
      const billed = client.invoices.reduce(
        (sum, invoice) => sum + toBaseAmount(invoice.total, invoice.exchangeRate),
        0,
      );
      const cost = client.expenses.reduce(
        (sum, expense) => sum + toBaseAmount(expense.amount, expense.exchangeRate),
        0,
      );
      return {
        id: client.id,
        name: client.name,
        billed,
        cost,
        margin: billed - cost,
        marginPercent: billed > 0 ? ((billed - cost) / billed) * 100 : 0,
      };
    })
    .filter((row) => row.billed > 0 || row.cost > 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, limit);
}
