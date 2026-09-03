import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { recentNotifications } from "@/lib/notifications";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await requireSession();
  const items = await recentNotifications(session.userId, 50);
  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifikasi"
        description={`${unread} belum dibaca`}
        action={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <SubmitButton variant="secondary" pendingLabel="...">
                Tandai semua dibaca
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      <Card>
        {items.length === 0 ? (
          <EmptyState
            title="Belum ada notifikasi"
            description="Invoice jatuh tempo, penawaran kedaluwarsa, dan pembayaran masuk akan muncul di sini."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const markRead = markNotificationRead.bind(null, item.id);
              return (
                <li
                  key={item.id}
                  className={`px-5 py-3 ${item.readAt ? "" : "bg-slate-50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {item.href ? (
                          <Link href={item.href} className="hover:underline">
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                      </p>
                      {item.body ? (
                        <p className="mt-0.5 text-xs text-slate-500">{item.body}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    {item.readAt ? null : (
                      <form action={markRead}>
                        <SubmitButton
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          pendingLabel="..."
                        >
                          Tandai dibaca
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
