import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { syncExpiredQuotes } from "@/lib/invoice";
import { notify } from "@/lib/notifications";
import { runDueRecurringInvoices } from "@/lib/recurring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const created = await runDueRecurringInvoices();
  await syncExpiredQuotes();

  for (const entry of created) {
    await notify({
      kind: "recurring_invoice",
      title: `Invoice langganan ${entry.invoice} terbit`,
      body: entry.template,
      href: "/invoices",
      dedupeKey: `recurring:${entry.invoice}`,
    });
  }

  return NextResponse.json({ ok: true, created: created.length, invoices: created });
}
