import { recordAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  AapanelClient,
  AapanelError,
  readExpiry,
  readSsl,
  type AapanelSite,
} from "@/lib/providers/aapanel";
import { startOfDaysFromToday } from "@/lib/time";

export function clientFor(node: { baseUrl: string; apiKeyEnc: string }) {
  return new AapanelClient(node.baseUrl, decryptSecret(node.apiKeyEnc));
}

/** aaPanel reports quota in bytes; zero means no quota was configured. */
function bytesOrNull(value: number | undefined) {
  if (value === undefined || value === null || value <= 0) return null;
  return value.toFixed(0);
}

export function formatBytes(value: unknown) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Pulls the current state of every mapped service on one server and writes it
 * onto the local records. Read-only against the panel: a difference found here
 * is recorded, never pushed back.
 */
export async function syncServerNode(nodeId: string) {
  const node = await prisma.serverNode.findUnique({
    where: { id: nodeId },
    include: { services: { where: { deletedAt: null } } },
  });
  if (!node) return { error: "Server tidak ditemukan" };

  let sites: AapanelSite[];
  try {
    const panel = clientFor(node);
    const system = await panel.getSystemTotal();
    sites = await panel.listSites();

    await prisma.serverNode.update({
      where: { id: nodeId },
      data: {
        panelVersion: system.version ?? null,
        lastCheckedAt: new Date(),
        lastStatus: "OK",
      },
    });
  } catch (error) {
    const message =
      error instanceof AapanelError ? error.message : String(error);
    await prisma.serverNode.update({
      where: { id: nodeId },
      data: { lastCheckedAt: new Date(), lastStatus: message },
    });
    return { error: message };
  }

  const byRemoteId = new Map(sites.map((site) => [String(site.id), site]));
  let updated = 0;
  let missing = 0;

  for (const service of node.services) {
    if (!service.remoteId) continue;

    const site = byRemoteId.get(service.remoteId);
    if (!site) {
      missing += 1;
      await prisma.service.update({
        where: { id: service.id },
        data: {
          syncError: "Situs tidak ditemukan lagi di panel",
          lastSyncedAt: new Date(),
        },
      });
      continue;
    }

    const ssl = readSsl(site);
    await prisma.service.update({
      where: { id: service.id },
      data: {
        remoteName: site.name,
        remoteRunning: site.status === "1",
        diskUsedBytes: bytesOrNull(site.quota?.used),
        diskQuotaBytes: bytesOrNull(site.quota?.size),
        phpVersion: site.php_version ?? null,
        sslIssuer: ssl?.issuer ?? null,
        sslExpiresAt: ssl?.expiresAt ?? null,
        remoteExpiresAt: readExpiry(site.edate),
        lastSyncedAt: new Date(),
        syncError: null,
      },
    });
    updated += 1;
  }

  return { updated, missing, total: sites.length };
}

export async function syncAllServerNodes() {
  const nodes = await prisma.serverNode.findMany({ where: { active: true } });
  const results = [];
  for (const node of nodes) {
    results.push({ node: node.name, ...(await syncServerNode(node.id)) });
  }
  return results;
}

/**
 * Raises one notification per certificate that expires within `days`.
 * Deduplicated on the expiry date so a renewal silences it automatically.
 */
export async function notifyExpiringCertificates(days = 21) {
  const cutoff = startOfDaysFromToday(days);
  const services = await prisma.service.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      sslExpiresAt: { not: null, lte: cutoff },
    },
    include: { client: { select: { name: true } } },
  });

  for (const service of services) {
    const expiry = service.sslExpiresAt!.toISOString().slice(0, 10);
    await notify({
      kind: "ssl_expiring",
      title: `Sertifikat SSL ${service.domain ?? service.name} berakhir ${expiry}`,
      body: `Layanan milik ${service.client.name}`,
      href: `/services/${service.id}`,
      dedupeKey: `ssl:${service.id}:${expiry}`,
    });
  }

  return services.length;
}

export async function testServerNode(nodeId: string) {
  const node = await prisma.serverNode.findUnique({ where: { id: nodeId } });
  if (!node) return { error: "Server tidak ditemukan" };

  try {
    const system = await clientFor(node).getSystemTotal();
    await prisma.serverNode.update({
      where: { id: nodeId },
      data: {
        panelVersion: system.version ?? null,
        lastCheckedAt: new Date(),
        lastStatus: "OK",
      },
    });
    await recordAudit(null, {
      action: "server.test",
      entity: "ServerNode",
      entityId: nodeId,
      summary: `Uji koneksi ke ${node.name} berhasil`,
    });
    return { system };
  } catch (error) {
    const message =
      error instanceof AapanelError ? error.message : String(error);
    await prisma.serverNode.update({
      where: { id: nodeId },
      data: { lastCheckedAt: new Date(), lastStatus: message },
    });
    return { error: message };
  }
}
