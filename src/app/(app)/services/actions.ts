"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/auth";
import { optionalString } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { syncServerNode } from "@/lib/services";
import { resumeService, suspendService } from "@/lib/suspension";
import type { ServiceStatus } from "@/generated/prisma/client";

/**
 * Attaches an existing panel site to a client. Stage 1 only maps what is
 * already there; nothing is created on the server.
 */
export async function createService(formData: FormData) {
  const session = await requireSession();

  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!clientId) throw new Error("Klien wajib dipilih");
  if (!name) throw new Error("Nama layanan wajib diisi");

  const serverNodeId = optionalString(formData.get("serverNodeId"));
  const remoteId = optionalString(formData.get("remoteId"));

  if (remoteId && serverNodeId) {
    const taken = await prisma.service.findFirst({
      where: { serverNodeId, remoteId, deletedAt: null },
    });
    if (taken) {
      throw new Error("Situs itu sudah dipetakan ke layanan lain");
    }
  }

  const service = await prisma.service.create({
    data: {
      clientId,
      serverNodeId,
      remoteId,
      remoteName: optionalString(formData.get("remoteName")),
      name,
      domain: optionalString(formData.get("domain")),
      status: String(formData.get("status") ?? "ACTIVE") as ServiceStatus,
      recurringInvoiceId: optionalString(formData.get("recurringInvoiceId")),
      notes: optionalString(formData.get("notes")),
    },
  });

  await recordAudit(session, {
    action: "service.create",
    entity: "Service",
    entityId: service.id,
    summary: `Menambah layanan "${name}"`,
  });

  if (serverNodeId) await syncServerNode(serverNodeId);

  revalidatePath("/services");
  redirect(`/services/${service.id}`);
}

export async function updateService(id: string, formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nama layanan wajib diisi");

  await prisma.service.update({
    where: { id },
    data: {
      name,
      domain: optionalString(formData.get("domain")),
      status: String(formData.get("status") ?? "ACTIVE") as ServiceStatus,
      recurringInvoiceId: optionalString(formData.get("recurringInvoiceId")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
  redirect(`/services/${id}`);
}

export async function syncService(id: string): Promise<ActionResult> {
  await requireSession();
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service?.serverNodeId) {
    return { error: "Layanan ini belum terhubung ke server mana pun" };
  }

  const result = await syncServerNode(service.serverNodeId);
  revalidatePath(`/services/${id}`);

  if ("error" in result && result.error) return { error: result.error };
  return { success: "Data dari panel diperbarui" };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const service = await prisma.service.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordAudit(session, {
    action: "service.delete",
    entity: "Service",
    entityId: id,
    summary: `Memindahkan layanan "${service.name}" ke sampah`,
  });

  revalidatePath("/services");
  redirect("/services");
}

/** Manual suspend from the service page, for cases the schedule does not cover. */
export async function suspendServiceNow(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const result = await suspendService(id, "Ditangguhkan manual oleh staf", session);

  revalidatePath(`/services/${id}`);
  revalidatePath("/services");

  if ("error" in result && result.error) return { error: result.error };
  return { success: "Layanan ditangguhkan di server" };
}

export async function resumeServiceNow(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const result = await resumeService(id, "Diaktifkan manual oleh staf", session);

  revalidatePath(`/services/${id}`);
  revalidatePath("/services");

  if ("error" in result && result.error) return { error: result.error };
  return { success: "Layanan aktif kembali" };
}

export async function toggleSuspendExempt(id: string): Promise<ActionResult> {
  await requireSession();
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) return { error: "Layanan tidak ditemukan" };

  await prisma.service.update({
    where: { id },
    data: { autoSuspendExempt: !service.autoSuspendExempt },
  });
  revalidatePath(`/services/${id}`);
}
