import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { notifyExpiringCertificates, syncAllServerNodes } from "@/lib/services";
import { runAutoSuspension } from "@/lib/suspension";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const synced = await syncAllServerNodes();
  const expiring = await notifyExpiringCertificates();
  // Reports what it would suspend while the feature is switched off.
  const suspension = await runAutoSuspension();

  return NextResponse.json({
    ok: true,
    servers: synced,
    expiringCertificates: expiring,
    suspension,
  });
}
