"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { dateField, optionalString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";

export async function createTask(formData: FormData) {
  const session = await requireSession();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Judul tugas wajib diisi");

  await prisma.task.create({
    data: {
      title,
      description: optionalString(formData.get("description")),
      priority: String(formData.get("priority") ?? "MEDIUM") as TaskPriority,
      status: String(formData.get("status") ?? "TODO") as TaskStatus,
      dueDate: dateField(formData.get("dueDate")),
      clientId: optionalString(formData.get("clientId")),
      dealId: optionalString(formData.get("dealId")),
      projectId: optionalString(formData.get("projectId")),
      assigneeId: session.userId,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  await requireSession();
  await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function deleteTask(id: string) {
  await requireSession();
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
