import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";
import { getCompanyProfile } from "@/lib/invoice";
import { projectStatusLabel } from "@/lib/labels";
import { toBaseAmount } from "@/lib/money";
import { formatHours, unbilledTimeValue } from "@/lib/projects";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  Select,
  buttonClass,
} from "@/components/ui";
import type { ProjectStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = readPage(params.page);
  const status = params.status ?? "";

  const where: Prisma.ProjectWhereInput = {};
  if (status && status in projectStatusLabel) {
    where.status = status as ProjectStatus;
  }

  const [profile, total, projects] = await Promise.all([
    getCompanyProfile(),
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        timeEntries: {
          select: { minutes: true, billable: true, hourlyRate: true, invoiceId: true },
        },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Proyek"
        description={`${total} proyek`}
        action={<LinkButton href="/projects/new">+ Proyek baru</LinkButton>}
      />

      <Card className="mb-4 p-4">
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <Select name="status" defaultValue={status}>
              <option value="">Semua</option>
              {Object.entries(projectStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <button type="submit" className={buttonClass("secondary")}>
            Terapkan
          </button>
          {status ? (
            <Link href="/projects" className={buttonClass("ghost")}>
              Reset
            </Link>
          ) : null}
        </form>
      </Card>

      <Card>
        {projects.length === 0 ? (
          <EmptyState
            title="Belum ada proyek"
            description="Proyek menghubungkan deal yang menang dengan waktu, biaya, dan invoicenya."
            action={
              <LinkButton href="/projects/new" className="mt-2">
                Buat proyek
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Proyek</th>
                  <th className="px-5 py-3 font-medium">Klien</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Waktu</th>
                  <th className="px-5 py-3 text-right font-medium">Belum ditagih</th>
                  <th className="px-5 py-3 font-medium">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((project) => {
                  const minutes = project.timeEntries.reduce(
                    (sum, entry) => sum + entry.minutes,
                    0,
                  );
                  const unbilled = toBaseAmount(
                    unbilledTimeValue(
                      project.timeEntries.map((entry) => ({
                        minutes: entry.minutes,
                        billable: entry.billable,
                        hourlyRate: entry.hourlyRate,
                        invoiceId: entry.invoiceId,
                      })),
                    ),
                    project.exchangeRate,
                  );

                  return (
                    <tr key={project.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {project.name}
                        </Link>
                        {project.code ? (
                          <p className="text-xs text-slate-500">{project.code}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/clients/${project.client.id}`}
                          className="text-slate-600 hover:underline"
                        >
                          {project.client.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          value={project.status}
                          label={projectStatusLabel[project.status]}
                        />
                      </td>
                      <td className="px-5 py-3 text-right text-slate-600">
                        {minutes > 0 ? formatHours(minutes) : "-"}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-slate-800">
                        {unbilled > 0
                          ? formatMoney(unbilled, profile.currency)
                          : "-"}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {project.endDate ? formatDate(project.endDate) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Pagination
        basePath="/projects"
        params={{ status }}
        page={page}
        total={total}
      />
    </div>
  );
}
