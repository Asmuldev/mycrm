import { getCompanyProfile } from "@/lib/invoice";
import { invoiceBalance } from "@/lib/money";
import { prisma } from "@/lib/prisma";

/**
 * Everything the portal shows for one client, loaded in a single place so the
 * link-based and account-based entry points can never drift apart — or worse,
 * differ in what they filter.
 */
export async function getPortalData(clientId: string) {
  const [profile, client, services, invoices, credits] = await Promise.all([
    getCompanyProfile(),
    prisma.client.findUnique({ where: { id: clientId } }),
    prisma.service.findMany({
      where: { clientId, status: { not: "TERMINATED" }, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.invoice.findMany({
      where: {
        clientId,
        // Drafts are internal working state; clients only see issued documents.
        status: { notIn: ["DRAFT", "CANCELLED"] },
        deletedAt: null,
      },
      orderBy: { issueDate: "desc" },
      take: 100,
    }),
    prisma.clientCredit.findMany({
      where: { clientId, remaining: { gt: 0 } },
    }),
  ]);

  if (!client || client.deletedAt) return null;

  return {
    profile,
    client,
    services,
    invoices,
    credits,
    outstanding: invoices.reduce(
      (sum, invoice) => sum + Math.max(invoiceBalance(invoice), 0),
      0,
    ),
    advanceRemaining: credits.reduce(
      (sum, credit) => sum + Number(credit.remaining),
      0,
    ),
  };
}

/**
 * Loads one invoice, but only if it belongs to the given client and is not a
 * draft. Returns null rather than throwing so callers render a plain 404.
 */
export async function getPortalInvoice(clientId: string, invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      schedules: { orderBy: { position: "asc" } },
      attachments: {
        where: { clientUploaded: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!invoice) return null;
  if (invoice.clientId !== clientId) return null;
  if (invoice.deletedAt) return null;
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return null;

  return invoice;
}
