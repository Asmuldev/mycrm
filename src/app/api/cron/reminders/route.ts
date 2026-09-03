import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { isEmailConfigured } from "@/lib/email";
import { getCompanyProfile, syncOverdueInvoices } from "@/lib/invoice";
import { startOfDaysFromToday, startOfToday } from "@/lib/time";
import { sendInvoiceEmail } from "@/lib/invoice-mailer";
import { notify } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  await syncOverdueInvoices();
  const profile = await getCompanyProfile();

  if (!profile.reminderEnabled) {
    return NextResponse.json({ ok: true, skipped: "Pengingat dinonaktifkan" });
  }
  // Without a mail provider every run would only add SKIPPED rows to EmailLog.
  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "RESEND_API_KEY atau EMAIL_FROM belum diisi",
    });
  }

  const today = startOfToday();
  const upcomingCutoff = startOfDaysFromToday(profile.reminderDaysBefore + 1);

  const resendCutoff = new Date(
    Date.now() - profile.reminderDaysAfter * 24 * 60 * 60 * 1000,
  );

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "PARTIAL", "OVERDUE"] },
      deletedAt: null,
      client: { email: { not: null }, deletedAt: null },
      OR: [
        // Approaching the due date, not yet reminded.
        { dueDate: { gte: today, lt: upcomingCutoff }, lastReminderAt: null },
        // Already overdue: repeat no more often than reminderDaysAfter.
        {
          dueDate: { lt: today },
          OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: resendCutoff } }],
        },
      ],
    },
    select: { id: true, number: true, dueDate: true },
    take: 100,
  });

  const results: Array<{ number: string; ok: boolean; error?: string }> = [];

  for (const invoice of invoices) {
    const overdue = new Date(invoice.dueDate) < today;
    if (overdue) {
      await notify({
        kind: "invoice_overdue",
        title: `Invoice ${invoice.number} lewat jatuh tempo`,
        href: `/invoices/${invoice.id}`,
        dedupeKey: `invoice_overdue:${invoice.id}:${invoice.dueDate.toISOString().slice(0, 10)}`,
      });
    }
    const result = await sendInvoiceEmail(
      invoice.id,
      overdue ? "invoice_overdue" : "invoice_reminder",
    );

    if (result.ok) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { lastReminderAt: new Date() },
      });
    }
    results.push({
      number: invoice.number,
      ok: result.ok,
      error: result.ok ? undefined : ("error" in result ? result.error : undefined),
    });
  }

  return NextResponse.json({
    ok: true,
    checked: invoices.length,
    sent: results.filter((entry) => entry.ok).length,
    results,
  });
}
