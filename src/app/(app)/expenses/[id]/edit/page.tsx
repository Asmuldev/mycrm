import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/invoice";
import { Card, PageHeader } from "@/components/ui";
import { updateExpense } from "../../actions";
import { ExpenseForm } from "../../expense-form";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [expense, clients, projects, profile] = await Promise.all([
    prisma.expense.findUnique({ where: { id } }),
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
  if (!expense || expense.deletedAt) notFound();

  const action = updateExpense.bind(null, expense.id);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit biaya" description={expense.description} />
      <Card className="p-5">
        <ExpenseForm
          action={action}
          clients={clients}
          projects={projects}
          values={expense}
          submitLabel="Simpan perubahan"
          cancelHref={`/expenses/${expense.id}`}
          baseCurrency={profile.currency}
        />
      </Card>
    </div>
  );
}
