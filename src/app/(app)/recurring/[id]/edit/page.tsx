import { notFound } from "next/navigation";
import { getCompanyProfile } from "@/lib/invoice";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { updateRecurring } from "../../actions";
import { RecurringForm } from "../../recurring-form";

export const dynamic = "force-dynamic";

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, clients, profile] = await Promise.all([
    prisma.recurringInvoice.findUnique({
      where: { id },
      include: { items: { orderBy: { position: "asc" } } },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCompanyProfile(),
  ]);
  if (!template) notFound();

  const action = updateRecurring.bind(null, template.id);

  return (
    <div>
      <PageHeader title="Edit langganan" description={template.title} />
      <Card className="p-5">
        <RecurringForm
          action={action}
          clients={clients}
          values={{
            title: template.title,
            clientId: template.clientId,
            frequency: template.frequency,
            interval: template.interval,
            startDate: template.startDate.toISOString(),
            endDate: template.endDate?.toISOString() ?? null,
            dueInDays: template.dueInDays,
            currency: template.currency,
            discount: Number(template.discount),
            taxRate: Number(template.taxRate),
            exchangeRate: Number(template.exchangeRate),
            withholdingRate: Number(template.withholdingRate),
            notes: template.notes,
            terms: template.terms,
            autoSend: template.autoSend,
            active: template.active,
            items: template.items.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            })),
          }}
          submitLabel="Simpan perubahan"
          cancelHref={`/recurring/${template.id}`}
          baseCurrency={profile.currency}
        />
      </Card>
    </div>
  );
}
