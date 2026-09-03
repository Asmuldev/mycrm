import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type SearchHit = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ hits: [] });

  const like = { contains: query, mode: "insensitive" as const };

  const [clients, invoices, deals, quotes, tasks] = await Promise.all([
    prisma.client.findMany({
      where: { OR: [{ name: like }, { company: like }, { email: like }, { phone: like }] },
      take: 5,
      select: { id: true, name: true, company: true, email: true },
    }),
    prisma.invoice.findMany({
      where: { OR: [{ number: like }, { client: { name: like } }] },
      take: 5,
      select: {
        id: true,
        number: true,
        status: true,
        client: { select: { name: true } },
      },
    }),
    prisma.deal.findMany({
      where: { OR: [{ title: like }, { client: { name: like } }] },
      take: 5,
      select: {
        id: true,
        title: true,
        stage: true,
        client: { select: { name: true } },
      },
    }),
    prisma.quote.findMany({
      where: { OR: [{ number: like }, { client: { name: like } }] },
      take: 5,
      select: {
        id: true,
        number: true,
        status: true,
        client: { select: { name: true } },
      },
    }),
    prisma.task.findMany({
      where: { title: like },
      take: 5,
      select: { id: true, title: true, status: true },
    }),
  ]);

  const hits: SearchHit[] = [
    ...clients.map((client) => ({
      id: `client-${client.id}`,
      group: "Klien",
      title: client.name,
      subtitle: client.company ?? client.email ?? "",
      href: `/clients/${client.id}`,
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      group: "Invoice",
      title: invoice.number,
      subtitle: `${invoice.client.name} · ${invoice.status}`,
      href: `/invoices/${invoice.id}`,
    })),
    ...quotes.map((quote) => ({
      id: `quote-${quote.id}`,
      group: "Penawaran",
      title: quote.number,
      subtitle: `${quote.client.name} · ${quote.status}`,
      href: `/quotes/${quote.id}`,
    })),
    ...deals.map((deal) => ({
      id: `deal-${deal.id}`,
      group: "Deal",
      title: deal.title,
      subtitle: `${deal.client.name} · ${deal.stage}`,
      href: `/deals/${deal.id}`,
    })),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      group: "Tugas",
      title: task.title,
      subtitle: task.status,
      href: `/tasks`,
    })),
  ];

  return NextResponse.json({ hits });
}
