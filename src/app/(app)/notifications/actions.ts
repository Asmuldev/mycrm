"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(id: string) {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { id, userId: session.userId },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { userId: session.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}
