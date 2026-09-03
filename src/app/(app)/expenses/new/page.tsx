import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/invoice";
import { Card, PageHeader } from "@/components/ui";
import { createExpense } from "../actions";
import { ExpenseForm } from "../expense-form";

export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; projectId?: string }>;
}) {
  const { clientId, projectId } = await searchParams;
  const [clients, projects, profile] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCompanyProfile(),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Biaya baru" description="Catat uang keluar" />
      <Card className="p-5">
        <ExpenseForm
          action={createExpense}
          clients={clients}
          projects={projects}
          values={{ clientId, projectId, currency: profile.currency }}
          submitLabel="Simpan biaya"
          cancelHref="/expenses"
          baseCurrency={profile.currency}
        />
      </Card>
    </div>
  );
}
