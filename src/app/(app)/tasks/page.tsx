import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateInput } from "@/lib/format";
import { taskPriorityLabel, taskStatusLabel } from "@/lib/labels";
import { PAGE_SIZE, Pagination, readPage } from "@/components/pagination";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  buttonClass,
} from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { createTask, deleteTask, setTaskStatus } from "./actions";
import { startOfToday } from "@/lib/time";
import type { Prisma, TaskStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    clientId?: string;
    dealId?: string;
    projectId?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const page = readPage(params.page);
  const where: Prisma.TaskWhereInput = {};
  if (params.status && params.status in taskStatusLabel) {
    where.status = params.status as TaskStatus;
  }
  if (params.clientId) where.clientId = params.clientId;
  if (params.dealId) where.dealId = params.dealId;
  if (params.projectId) where.projectId = params.projectId;

  const [total, openCount, tasks, clients, deals, projects] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: { ...where, status: { not: "DONE" } } }),
    prisma.task.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        client: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.deal.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const today = startOfToday();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PageHeader
          title="Tugas"
          description={`${openCount} tugas terbuka dari ${total}`}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/tasks"
            className={buttonClass(params.status ? "ghost" : "secondary")}
          >
            Semua
          </Link>
          {Object.entries(taskStatusLabel).map(([value, label]) => (
            <Link
              key={value}
              href={`/tasks?status=${value}`}
              className={buttonClass(
                params.status === value ? "secondary" : "ghost",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        <Card>
          {tasks.length === 0 ? (
            <EmptyState
              title="Belum ada tugas"
              description="Buat tugas lewat form di samping."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((task) => {
                const overdue =
                  task.status !== "DONE" &&
                  task.dueDate &&
                  new Date(task.dueDate) < today;
                const toggle = setTaskStatus.bind(
                  null,
                  task.id,
                  task.status === "DONE" ? "TODO" : "DONE",
                );
                const advance = setTaskStatus.bind(null, task.id, "IN_PROGRESS");
                const removeTask = deleteTask.bind(null, task.id);

                return (
                  <li key={task.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={
                            task.status === "DONE"
                              ? "text-sm text-slate-400 line-through"
                              : "text-sm font-medium text-slate-800"
                          }
                        >
                          {task.title}
                        </p>
                        {task.description ? (
                          <p className="mt-0.5 text-xs whitespace-pre-wrap text-slate-500">
                            {task.description}
                          </p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className={overdue ? "text-rose-600" : ""}>
                            {task.dueDate
                              ? formatDate(task.dueDate)
                              : "tanpa deadline"}
                          </span>
                          {task.client ? (
                            <Link
                              href={`/clients/${task.client.id}`}
                              className="underline"
                            >
                              {task.client.name}
                            </Link>
                          ) : null}
                          {task.deal ? (
                            <Link
                              href={`/deals/${task.deal.id}`}
                              className="underline"
                            >
                              {task.deal.title}
                            </Link>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex gap-1.5">
                          <Badge
                            value={task.priority}
                            label={taskPriorityLabel[task.priority]}
                          />
                          <Badge
                            value={task.status}
                            label={taskStatusLabel[task.status]}
                          />
                        </div>
                        <div className="flex gap-1">
                          <form action={toggle}>
                            <SubmitButton
                              variant="ghost"
                              className="px-2 py-1 text-xs"
                              pendingLabel="..."
                            >
                              {task.status === "DONE" ? "Buka lagi" : "Selesai"}
                            </SubmitButton>
                          </form>
                          {task.status === "TODO" ? (
                            <form action={advance}>
                              <SubmitButton
                                variant="ghost"
                                className="px-2 py-1 text-xs"
                                pendingLabel="..."
                              >
                                Kerjakan
                              </SubmitButton>
                            </form>
                          ) : null}
                          <form action={removeTask}>
                            <ConfirmButton
                              message={`Hapus tugas "${task.title}"?`}
                              variant="ghost"
                              className="px-2 py-1 text-xs text-rose-600"
                            >
                              Hapus
                            </ConfirmButton>
                          </form>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Pagination
          basePath="/tasks"
          params={{
            status: params.status,
            clientId: params.clientId,
            dealId: params.dealId,
            projectId: params.projectId,
          }}
          page={page}
          total={total}
        />
      </div>

      <Card className="h-fit lg:mt-[76px]">
        <CardHeader title="Tugas baru" />
        <form action={createTask} className="space-y-3 px-5 py-4">
          <Field label="Judul *">
            <Input name="title" required placeholder="Follow up proposal" />
          </Field>
          <Field label="Deskripsi">
            <Textarea name="description" rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Deadline">
              <Input
                name="dueDate"
                type="date"
                defaultValue={formatDateInput(new Date())}
              />
            </Field>
            <Field label="Prioritas">
              <Select name="priority" defaultValue="MEDIUM">
                {Object.entries(taskPriorityLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Klien">
            <Select name="clientId" defaultValue={params.clientId ?? ""}>
              <option value="">Tanpa klien</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deal">
            <Select name="dealId" defaultValue={params.dealId ?? ""}>
              <option value="">Tanpa deal</option>
              {deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proyek">
            <Select name="projectId" defaultValue={params.projectId ?? ""}>
              <option value="">Tanpa proyek</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <SubmitButton className="w-full">+ Tambah tugas</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
