"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { dealStageLabel, dealStages } from "@/lib/labels";
import { formatDate, formatMoney } from "@/lib/format";
import { Card, cn } from "@/components/ui";
import { moveDealStage } from "./actions";

export type KanbanDeal = {
  id: string;
  title: string;
  stage: string;
  value: number;
  baseValue: number;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  clientId: string;
  clientName: string;
};

export function KanbanBoard({
  deals,
  baseCurrency,
}: {
  deals: KanbanDeal[];
  baseCurrency: string;
}) {
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);

  // Move the card immediately; the server action reconciles on the next render.
  const [optimisticDeals, applyMove] = useOptimistic(
    deals,
    (current, move: { id: string; stage: string }) =>
      current.map((deal) =>
        deal.id === move.id ? { ...deal, stage: move.stage } : deal,
      ),
  );

  function move(id: string, stage: string) {
    const deal = optimisticDeals.find((entry) => entry.id === id);
    if (!deal || deal.stage === stage) return;

    startTransition(async () => {
      applyMove({ id, stage });
      const formData = new FormData();
      formData.set("stage", stage);
      await moveDealStage(id, formData);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {dealStages.map((stage) => {
        const stageDeals = optimisticDeals.filter((deal) => deal.stage === stage);
        const stageValue = stageDeals.reduce(
          (sum, deal) => sum + deal.baseValue,
          0,
        );

        return (
          <div key={stage} className="flex flex-col">
            <div className="mb-1 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-semibold text-slate-800">
                {dealStageLabel[stage]}
              </h2>
              <span className="text-xs text-slate-500">{stageDeals.length}</span>
            </div>
            <p className="mb-2 px-1 text-xs text-slate-400">
              {formatMoney(stageValue, baseCurrency)}
            </p>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setHoverStage(stage);
              }}
              onDragLeave={() => setHoverStage((s) => (s === stage ? null : s))}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || dragging;
                setHoverStage(null);
                setDragging(null);
                if (id) move(id, stage);
              }}
              className={cn(
                "flex min-h-[140px] flex-col gap-2 rounded-xl p-2 transition",
                hoverStage === stage
                  ? "bg-slate-200 ring-2 ring-slate-300"
                  : "bg-slate-100",
              )}
            >
              {stageDeals.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-400">
                  Tarik deal ke sini
                </p>
              ) : (
                stageDeals.map((deal) => (
                  <Card
                    key={deal.id}
                    className={cn(
                      "cursor-grab p-3 active:cursor-grabbing",
                      dragging === deal.id && "opacity-50",
                    )}
                  >
                    <div
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", deal.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(deal.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setHoverStage(null);
                      }}
                    >
                      <Link
                        href={`/deals/${deal.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                        draggable={false}
                      >
                        {deal.title}
                      </Link>
                      <Link
                        href={`/clients/${deal.clientId}`}
                        className="mt-0.5 block truncate text-xs text-slate-500 hover:underline"
                        draggable={false}
                      >
                        {deal.clientName}
                      </Link>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {formatMoney(deal.value, deal.currency)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {deal.probability}% ·{" "}
                        {deal.expectedCloseDate
                          ? formatDate(deal.expectedCloseDate)
                          : "tanpa target"}
                      </p>
                    </div>

                    {/* Keyboard and touch fallback for the drag interaction. */}
                    <select
                      value={deal.stage}
                      aria-label={`Pindahkan ${deal.title}`}
                      onChange={(event) => move(deal.id, event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-400"
                    >
                      {dealStages.map((option) => (
                        <option key={option} value={option}>
                          {dealStageLabel[option]}
                        </option>
                      ))}
                    </select>
                  </Card>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
