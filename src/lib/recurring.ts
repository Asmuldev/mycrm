import { addDays } from "date-fns";
import { nextInvoiceNumber, recalcInvoice } from "@/lib/invoice";
import { startOfToday } from "@/lib/time";
import { sendInvoiceEmail } from "@/lib/invoice-mailer";
import { prisma } from "@/lib/prisma";
import { advanceDate, dueRunDates } from "@/lib/schedule";

export { advanceDate };

/**
 * Generates invoices for every active schedule whose nextRunAt has arrived.
 * Catches up on missed runs so a downtime window does not skip a billing cycle.
 */
export async function runDueRecurringInvoices(now = new Date()) {
  const due = await prisma.recurringInvoice.findMany({
    where: {
      active: true,
      nextRunAt: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  const created: Array<{ template: string; invoice: string }> = [];

  for (const template of due) {
    if (template.items.length === 0) continue;

    const schedule = dueRunDates(
      template.nextRunAt,
      now,
      template.frequency,
      template.interval,
      template.endDate,
    );

    for (const issueDate of schedule.runs) {
      const invoice = await prisma.invoice.create({
        data: {
          number: await nextInvoiceNumber(),
          clientId: template.clientId,
          recurringInvoiceId: template.id,
          status: template.autoSend ? "SENT" : "DRAFT",
          issueDate,
          dueDate: addDays(issueDate, template.dueInDays),
          currency: template.currency,
          exchangeRate: template.exchangeRate,
          discount: template.discount,
          taxRate: template.taxRate,
          withholdingRate: template.withholdingRate,
          notes: template.notes,
          terms: template.terms,
          sentAt: template.autoSend ? new Date() : null,
          items: {
            create: template.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: (Number(item.quantity) * Number(item.unitPrice)).toFixed(2),
              position: item.position,
            })),
          },
        },
      });

      await recalcInvoice(invoice.id);
      if (template.autoSend) {
        await sendInvoiceEmail(invoice.id, "invoice_sent");
      }

      created.push({ template: template.title, invoice: invoice.number });
    }

    await prisma.recurringInvoice.update({
      where: { id: template.id },
      data: {
        nextRunAt: schedule.nextRunAt,
        lastRunAt: new Date(),
        active: template.endDate
          ? schedule.nextRunAt <= template.endDate
          : true,
      },
    });
  }

  return created;
}

export function firstRunDate(startDate: Date) {
  const today = startOfToday();
  return startDate < today ? today : startDate;
}
