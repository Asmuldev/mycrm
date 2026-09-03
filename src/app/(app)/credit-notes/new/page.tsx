import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/format";
import { invoiceBalance } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui";
import { createCreditNote } from "../actions";
import { CreditNoteForm } from "../credit-note-form";

export const dynamic = "force-dynamic";

export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const { invoiceId } = await searchParams;
  if (!invoiceId) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: { select: { name: true } },
      items: { orderBy: { position: "asc" } },
    },
  });
  if (!invoice || invoice.deletedAt) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Nota kredit baru"
        description={`Koreksi untuk ${invoice.number} · ${invoice.client.name}`}
      />
      <Card className="p-5">
        <CreditNoteForm
          action={createCreditNote}
          today={formatDateInput(new Date())}
          invoice={{
            id: invoice.id,
            number: invoice.number,
            currency: invoice.currency,
            taxRate: Number(invoice.taxRate),
            balance: invoiceBalance(invoice),
            items: invoice.items.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            })),
          }}
        />
      </Card>
    </div>
  );
}
