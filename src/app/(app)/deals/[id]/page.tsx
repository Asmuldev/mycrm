import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { dealStageLabel, taskStatusLabel } from "@/lib/labels";
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
import { deleteDeal, moveDealStage } from "../actions";
import { StageSelect } from "./stage-select";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      activities: { orderBy: { occurredAt: "desc" }, take: 20 },
    },
  });
  if (!deal || deal.deletedAt) notFound();

  const removeDeal = deleteDeal.bind(null, deal.id);
  const weighted = (Number(deal.value) * deal.probability) / 100;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={deal.title}
        description={`Klien: ${deal.client.name}`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href={`/quotes/new?clientId=${deal.client.id}&dealId=${deal.id}`}
              variant="secondary"
            >
              Buat penawaran
            </LinkButton>
            <LinkButton
              href={`/projects/new?clientId=${deal.client.id}&dealId=${deal.id}`}
              variant="secondary"
            >
              Buat proyek
            </LinkButton>
            <LinkButton href={`/deals/${deal.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <form action={removeDeal}>
              <ConfirmButton message={`Hapus deal "${deal.title}"?`}>
                Hapus
              </ConfirmButton>
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Nilai deal</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(deal.value, deal.currency)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Nilai tertimbang</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {formatMoney(weighted, deal.currency)}
          </p>
          <p className="text-xs text-slate-400">{deal.probability}% peluang</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Tahap</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge value={deal.stage} label={dealStageLabel[deal.stage]} />
            <StageSelect
              dealId={deal.id}
              stage={deal.stage}
              action={moveDealStage}
            />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Detail" />
        <dl className="grid grid-cols-1 gap-3 px-5 py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Klien</dt>
            <dd>
              <Link
                href={`/clients/${deal.client.id}`}
                className="text-slate-800 underline"
              >
                {deal.client.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Target tutup</dt>
            <dd className="text-slate-800">
              {formatDate(deal.expectedCloseDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Ditutup pada</dt>
            <dd className="text-slate-800">{formatDate(deal.closedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Dibuat</dt>
            <dd className="text-slate-800">{formatDate(deal.createdAt)}</dd>
          </div>
        </dl>
        {deal.notes ? (
          <p className="border-t border-slate-100 px-5 py-3 text-sm whitespace-pre-wrap text-slate-600">
            {deal.notes}
          </p>
        ) : null}
      </Card>

      <div className="mt-4">
        <CustomFieldsCard
          entity="DEAL"
          entityId={deal.id}
          revalidate={`/deals/${deal.id}`}
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Tugas terkait"
          action={
            <LinkButton
              href={`/tasks?dealId=${deal.id}`}
              variant="secondary"
              className="px-2 py-1 text-xs"
            >
              Kelola tugas
            </LinkButton>
          }
        />
        {deal.tasks.length === 0 ? (
          <EmptyState title="Belum ada tugas" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {deal.tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    {task.dueDate ? formatDate(task.dueDate) : "tanpa deadline"}
                  </p>
                </div>
                <Badge value={task.status} label={taskStatusLabel[task.status]} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
