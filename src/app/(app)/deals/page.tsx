import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { toBaseAmount } from "@/lib/money";
import { LinkButton, PageHeader } from "@/components/ui";
import { KanbanBoard, type KanbanDeal } from "./kanban-board";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const profile = await getCompanyProfile();
  // A kanban board cannot paginate sensibly, so it shows the most recent
  // cards and reports when older ones are hidden.
  const BOARD_LIMIT = 300;
  const [dealCount, deals] = await Promise.all([
    prisma.deal.count(),
    prisma.deal.findMany({
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: BOARD_LIMIT,
    }),
  ]);

  const cards: KanbanDeal[] = deals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    value: Number(deal.value),
    baseValue: toBaseAmount(deal.value, deal.exchangeRate),
    currency: deal.currency,
    probability: deal.probability,
    expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
    clientId: deal.client.id,
    clientName: deal.client.name,
  }));

  const openValue = cards
    .filter((deal) => deal.stage !== "WON" && deal.stage !== "LOST")
    .reduce((sum, deal) => sum + deal.baseValue, 0);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={`${dealCount} deal · nilai terbuka ${formatMoney(openValue, profile.currency)} · tarik kartu untuk pindah tahap${
          dealCount > cards.length
            ? ` · menampilkan ${cards.length} terbaru`
            : ""
        }`}
        action={<LinkButton href="/deals/new">+ Deal baru</LinkButton>}
      />
      <KanbanBoard deals={cards} baseCurrency={profile.currency} />
    </div>
  );
}
