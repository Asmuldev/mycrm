"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/components/action-button";
import { recordAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { syncServerNode, testServerNode } from "@/lib/services";

export type ServerState = { error?: string; success?: string };

export async function createServerNode(
  _prev: ServerState,
  formData: FormData,
): Promise<ServerState> {
  const session = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim().replace(/\/$/, "");
  const apiKey = String(formData.get("apiKey") ?? "").trim();

  if (name.length < 2) return { error: "Nama server wajib diisi" };
  if (!/^https?:\/\/.+/.test(baseUrl)) {
    return { error: "Alamat panel harus diawali http:// atau https://" };
  }
  if (apiKey.length < 8) return { error: "Kunci API tidak valid" };

  const node = await prisma.serverNode.create({
    data: { name, baseUrl, apiKeyEnc: encryptSecret(apiKey) },
  });

  await recordAudit(session, {
    action: "server.create",
    entity: "ServerNode",
    entityId: node.id,
    summary: `Menambah server ${name}`,
  });

  // Prove the credentials work straight away rather than at first sync.
  const result = await testServerNode(node.id);
  revalidatePath("/settings/servers");

  if (result.error) {
    return {
      error: `Server tersimpan, tapi uji koneksi gagal: ${result.error}`,
    };
  }
  return {
    success: `Terhubung ke ${name} — panel versi ${result.system?.version ?? "?"}`,
  };
}

export async function testServer(id: string): Promise<ActionResult> {
  await requireAdmin();
  const result = await testServerNode(id);
  revalidatePath("/settings/servers");

  if (result.error) return { error: result.error };
  return {
    success: `Terhubung. Panel versi ${result.system?.version ?? "?"}, ${
      result.system?.cpuNum ?? "?"
    } core.`,
  };
}

export async function syncServer(id: string): Promise<ActionResult> {
  await requireAdmin();
  const result = await syncServerNode(id);
  revalidatePath("/settings/servers");
  revalidatePath("/services");

  if ("error" in result && result.error) return { error: result.error };
  return {
    success: `Sinkron selesai. ${result.updated ?? 0} layanan diperbarui, ${
      result.missing ?? 0
    } tidak ditemukan, ${result.total ?? 0} situs di panel.`,
  };
}

export async function toggleServer(id: string): Promise<ActionResult> {
  await requireAdmin();
  const node = await prisma.serverNode.findUnique({ where: { id } });
  if (!node) return { error: "Server tidak ditemukan" };

  await prisma.serverNode.update({
    where: { id },
    data: { active: !node.active },
  });
  revalidatePath("/settings/servers");
}

export async function deleteServerNode(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const count = await prisma.service.count({ where: { serverNodeId: id } });
  if (count > 0) {
    return {
      error: `Server ini masih dipakai ${count} layanan. Lepaskan layanannya dulu.`,
    };
  }

  const node = await prisma.serverNode.delete({ where: { id } });
  await recordAudit(session, {
    action: "server.delete",
    entity: "ServerNode",
    entityId: id,
    summary: `Menghapus server ${node.name}`,
  });
  revalidatePath("/settings/servers");
}

export type ImportState = { error?: string; success?: string };

/**
 * Lists the sites on a panel that are not mapped to a service yet, so staff can
 * attach each one to the client who pays for it.
 */
export async function listUnmappedSites(nodeId: string) {
  await requireAdmin();
  const node = await prisma.serverNode.findUnique({ where: { id: nodeId } });
  if (!node) return { error: "Server tidak ditemukan", sites: [] };

  const { clientFor } = await import("@/lib/services");
  try {
    const sites = await clientFor(node).listSites();
    const mapped = await prisma.service.findMany({
      where: { serverNodeId: nodeId, remoteId: { not: null } },
      select: { remoteId: true },
    });
    const taken = new Set(mapped.map((entry) => entry.remoteId));

    return {
      sites: sites
        .filter((site) => !taken.has(String(site.id)))
        .map((site) => ({
          id: String(site.id),
          name: site.name,
          running: site.status === "1",
        })),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      sites: [],
    };
  }
}
