import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/invoice";
import { Card, PageHeader } from "@/components/ui";
import { updateProject } from "../../actions";
import { ProjectForm } from "../../project-form";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients, deals, profile] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
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
  if (!project || project.deletedAt) notFound();

  const action = updateProject.bind(null, project.id);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit proyek" description={project.name} />
      <Card className="p-5">
        <ProjectForm
          action={action}
          clients={clients}
          deals={deals}
          values={project}
          submitLabel="Simpan perubahan"
          cancelHref={`/projects/${project.id}`}
          baseCurrency={profile.currency}
        />
      </Card>
    </div>
  );
}
