"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { requireAdmin } from "@/lib/permissions";
import { dateField, optionalString, toNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { DealStage } from "@/generated/prisma/client";

function readDealForm(formData: FormData) {
  const rate = toNumber(formData.get("exchangeRate"), 1);
  return {
    title: String(formData.get("title") ?? "").trim(),
    clientId: String(formData.get("clientId") ?? ""),
    value: toNumber(formData.get("value")).toFixed(2),
    currency: String(formData.get("currency") ?? "IDR"),
    exchangeRate: (rate > 0 ? rate : 1).toFixed(6),
    stage: String(formData.get("stage") ?? "LEAD") as DealStage,
    probability: Math.min(Math.max(toNumber(formData.get("probability"), 10), 0), 100),
    expectedCloseDate: dateField(formData.get("expectedCloseDate")),
    notes: optionalString(formData.get("notes")),
  };
}

export async function createDeal(formData: FormData) {
  const session = await requireSession();
  const data = readDealForm(formData);
  if (!data.title) throw new Error("Judul deal wajib diisi");
  if (!data.clientId) throw new Error("Klien wajib dipilih");

  const deal = await prisma.deal.create({
    data: {
      ...data,
      ownerId: session.userId,
      closedAt: data.stage === "WON" || data.stage === "LOST" ? new Date() : null,
    },
  });
  revalidatePath("/deals");
  redirect(`/deals/${deal.id}`);
}

export async function updateDeal(id: string, formData: FormData) {
  await requireSession();
  const data = readDealForm(formData);
  if (!data.title) throw new Error("Judul deal wajib diisi");

  const closing = data.stage === "WON" || data.stage === "LOST";
  await prisma.deal.update({
    where: { id },
    data: { ...data, closedAt: closing ? new Date() : null },
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  redirect(`/deals/${id}`);
}

export async function moveDealStage(id: string, formData: FormData) {
  await requireSession();
  const stage = String(formData.get("stage") ?? "") as DealStage;
  if (!stage) return;

  const closing = stage === "WON" || stage === "LOST";
  await prisma.deal.update({
    where: { id },
    data: { stage, closedAt: closing ? new Date() : null },
  });
  revalidatePath("/deals");
  revalidatePath(`/deals/${id}`);
  revalidatePath("/dashboard");
}

export async function deleteDeal(id: string) {
  const session = await requireAdmin();
  const deal = await prisma.deal.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await recordAudit(session, {
    action: "deal.delete",
    entity: "Deal",
    entityId: id,
    summary: `Memindahkan deal "${deal.title}" ke sampah`,
  });
  revalidatePath("/deals");
  redirect("/deals");
}
