import { prisma } from "@/lib/prisma";

export type NotifyInput = {
  kind: string;
  title: string;
  body?: string;
  href?: string;
  /** Same key twice means the same alert; the second write is ignored. */
  dedupeKey?: string;
  userId?: string | null;
};

/**
 * Writes one notification per active user (or one targeted user). Never throws:
 * a failed notification must not roll back the action that triggered it.
 */
export async function notify(input: NotifyInput) {
  try {
    if (input.userId) {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? null,
          dedupeKey: input.dedupeKey ?? null,
        },
      });
      return;
    }

    const users = await prisma.user.findMany({ select: { id: true } });
    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${user.id}` : null,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("notify failed", error);
  }
}

export async function unreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function recentNotifications(userId: string, take = 15) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
