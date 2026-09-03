import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { notifyExpiringCertificates, syncAllServerNodes } from "@/lib/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const synced = await syncAllServerNodes();
  const expiring = await notifyExpiringCertificates();

  return NextResponse.json({ ok: true, servers: synced, expiringCertificates: expiring });
}
