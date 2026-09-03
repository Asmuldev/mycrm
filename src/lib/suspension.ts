import { recordAudit } from "@/lib/audit";
import { getCompanyProfile } from "@/lib/invoice";
import { invoiceBalance } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { AapanelError } from "@/lib/providers/aapanel";
import { clientFor } from "@/lib/services";
import { startOfToday } from "@/lib/time";
import type { SessionPayload } from "@/lib/session";

export type SuspensionCandidate = {
  serviceId: string;
  serviceName: string;
  clientName: string;
  invoiceNumber: string;
  daysOverdue: number;
};

/**
 * Services whose billing invoice has been overdue longer than the configured
 * grace period. Exempt services and ones already suspended are left out.
 */
export async function findSuspensionCandidates(): Promise<SuspensionCandidate[]> {
  const profile = await getCompanyProfile();
  const today = startOfToday();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - profile.autoSuspendAfterDays);

  const services = await prisma.service.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      autoSuspendExempt: false,
      serverNodeId: { not: null },
      remoteId: { not: null },
      recurringInvoiceId: { not: null },
    },
    include: {
      client: { select: { name: true } },
      recurringInvoice: {
        select: {
          invoices: {
            where: {
              status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
              deletedAt: null,
              dueDate: { lt: cutoff },
            },
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
  });

  const candidates: SuspensionCandidate[] = [];

  for (const service of services) {
    const overdue = service.recurringInvoice?.invoices.find(
      (invoice) => invoiceBalance(invoice) > 0,
    );
    if (!overdue) continue;

    candidates.push({
      serviceId: service.id,
      serviceName: service.name,
      clientName: service.client.name,
      invoiceNumber: overdue.number,
      daysOverdue: Math.floor(
        (today.getTime() - new Date(overdue.dueDate).getTime()) / 86_400_000,
      ),
    });
  }

  return candidates;
}

async function panelFor(serviceId: string) {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { serverNode: true, client: { select: { name: true } } },
  });

  if (!service) return { error: "Layanan tidak ditemukan" as const };
  if (!service.serverNode || !service.remoteId || !service.remoteName) {
    return { error: "Layanan belum dipetakan ke situs di panel" as const };
  }
  if (!service.serverNode.active) {
    return { error: "Server sedang dinonaktifkan" as const };
  }

  return { service, panel: clientFor(service.serverNode) };
}

/** Stops the site and records why. Used by the cron and by the manual button. */
export async function suspendService(
  serviceId: string,
  reason: string,
  session: SessionPayload | null = null,
) {
  const resolved = await panelFor(serviceId);
  if ("error" in resolved) return { error: resolved.error };

  const { service, panel } = resolved;

  try {
    await panel.suspendSite({
      id: service.remoteId!,
      name: service.remoteName!,
    });
  } catch (error) {
    const message =
      error instanceof AapanelError ? error.message : String(error);
    await prisma.service.update({
      where: { id: serviceId },
      data: { syncError: `Gagal menangguhkan: ${message}` },
    });
    return { error: message };
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      status: "SUSPENDED",
      suspendedAt: new Date(),
      suspendReason: reason,
      remoteRunning: false,
      syncError: null,
    },
  });

  await recordAudit(session, {
    action: "service.suspend",
    entity: "Service",
    entityId: serviceId,
    summary: `Menangguhkan "${service.name}" (${service.client.name}): ${reason}`,
  });

  await notify({
    kind: "service_suspended",
    title: `Layanan ${service.name} ditangguhkan`,
    body: `${service.client.name} · ${reason}`,
    href: `/services/${serviceId}`,
    dedupeKey: `suspend:${serviceId}:${new Date().toISOString().slice(0, 10)}`,
  });

  return { ok: true as const };
}

/**
 * Starts the site again. Only touches services this app suspended, so a site
 * stopped by hand in the panel is not silently switched back on.
 */
export async function resumeService(
  serviceId: string,
  reason: string,
  session: SessionPayload | null = null,
  options: { onlyIfAutoSuspended?: boolean } = {},
) {
  const resolved = await panelFor(serviceId);
  if ("error" in resolved) return { error: resolved.error };

  const { service, panel } = resolved;

  if (options.onlyIfAutoSuspended && !service.suspendedAt) {
    return { skipped: "Layanan ini tidak ditangguhkan oleh aplikasi" as const };
  }

  try {
    await panel.resumeSite({
      id: service.remoteId!,
      name: service.remoteName!,
    });
  } catch (error) {
    const message =
      error instanceof AapanelError ? error.message : String(error);
    await prisma.service.update({
      where: { id: serviceId },
      data: { syncError: `Gagal mengaktifkan: ${message}` },
    });
    return { error: message };
  }

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      status: "ACTIVE",
      suspendedAt: null,
      suspendReason: null,
      remoteRunning: true,
      syncError: null,
    },
  });

  await recordAudit(session, {
    action: "service.resume",
    entity: "Service",
    entityId: serviceId,
    summary: `Mengaktifkan kembali "${service.name}" (${service.client.name}): ${reason}`,
  });

  await notify({
    kind: "service_resumed",
    title: `Layanan ${service.name} aktif kembali`,
    body: service.client.name,
    href: `/services/${serviceId}`,
  });

  return { ok: true as const };
}

/**
 * Runs the overdue check. Reports what it would do and only acts when
 * automatic suspension is switched on, so the feature can be watched for a
 * while before it is trusted with customer sites.
 */
export async function runAutoSuspension() {
  const profile = await getCompanyProfile();
  const candidates = await findSuspensionCandidates();

  if (!profile.autoSuspendEnabled) {
    return {
      enabled: false,
      wouldSuspend: candidates,
      suspended: [] as string[],
    };
  }

  const suspended: string[] = [];
  const failed: Array<{ service: string; error: string }> = [];

  for (const candidate of candidates) {
    const result = await suspendService(
      candidate.serviceId,
      `Invoice ${candidate.invoiceNumber} lewat jatuh tempo ${candidate.daysOverdue} hari`,
    );
    if ("error" in result && result.error) {
      failed.push({ service: candidate.serviceName, error: result.error });
    } else {
      suspended.push(candidate.serviceName);
    }
  }

  return { enabled: true, wouldSuspend: candidates, suspended, failed };
}

/**
 * Called after money lands against an invoice. Resumes every service billed by
 * that invoice's subscription, provided nothing else is still overdue.
 */
export async function resumeServicesForInvoice(invoiceId: string) {
  const profile = await getCompanyProfile();
  if (!profile.autoResumeOnPayment) return [];

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { recurringInvoiceId: true },
  });
  if (!invoice?.recurringInvoiceId) return [];

  const services = await prisma.service.findMany({
    where: {
      recurringInvoiceId: invoice.recurringInvoiceId,
      status: "SUSPENDED",
      suspendedAt: { not: null },
      deletedAt: null,
    },
    include: {
      recurringInvoice: {
        select: {
          invoices: {
            where: {
              status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
              deletedAt: null,
            },
          },
        },
      },
    },
  });

  const resumed: string[] = [];

  for (const service of services) {
    // One paid invoice does not clear an account with other unpaid ones.
    const stillOwing = service.recurringInvoice?.invoices.some(
      (entry) => invoiceBalance(entry) > 0,
    );
    if (stillOwing) continue;

    const result = await resumeService(
      service.id,
      "Pembayaran diterima",
      null,
      { onlyIfAutoSuspended: true },
    );
    if ("ok" in result) resumed.push(service.name);
  }

  return resumed;
}
