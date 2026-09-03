import { notFound } from "next/navigation";
import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { updateInvoice } from "../../actions";
import { InvoiceForm } from "../../invoice-form";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, clients, profile] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCompanyProfile(),
  ]);
  if (!invoice || invoice.deletedAt) notFound();

  const action = updateInvoice.bind(null, invoice.id);
  // Decimal/Date instances cannot cross the client boundary.
  const values = {
    clientId: invoice.clientId,
    status: invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    currency: invoice.currency,
    discount: Number(invoice.discount),
    taxRate: Number(invoice.taxRate),
    withholdingRate: Number(invoice.withholdingRate),
    exchangeRate: Number(invoice.exchangeRate),
    notes: invoice.notes,
    terms: invoice.terms,
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
  };

  return (
    <div>
      <PageHeader title="Edit invoice" description={invoice.number} />
      <Card className="p-5">
        <InvoiceForm
          action={action}
          clients={clients}
          values={values}
          submitLabel="Simpan perubahan"
          cancelHref={`/invoices/${invoice.id}`}
          baseCurrency={profile.currency}
        />
      </Card>
    </div>
  );
}
