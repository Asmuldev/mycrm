import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/invoice";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { createProject } from "../actions";
import { ProjectForm } from "../project-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; dealId?: string }>;
}) {
  const { clientId, dealId } = await searchParams;
  const [clients, deals, profile] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.deal.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
    getCompanyProfile(),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Proyek baru"
        description="Wadah untuk pekerjaan, waktu, biaya, dan tagihannya"
      />
      <Card className="p-5">
        {clients.length === 0 ? (
          <EmptyState
            title="Belum ada klien"
            action={
              <LinkButton href="/clients/new" className="mt-2">
                Tambah klien
              </LinkButton>
            }
          />
        ) : (
          <ProjectForm
            action={createProject}
            clients={clients}
            deals={deals}
            values={{ clientId, dealId, currency: profile.currency }}
            submitLabel="Simpan proyek"
            cancelHref="/projects"
            baseCurrency={profile.currency}
          />
        )}
      </Card>
    </div>
  );
}
