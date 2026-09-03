import Link from "next/link";
import { Bell } from "lucide-react";
import { unreadNotificationCount } from "@/lib/notifications";

export async function NotificationBell({ userId }: { userId: string }) {
  const unread = await unreadNotificationCount(userId);

  return (
    <Link
      href="/notifications"
      aria-label={
        unread > 0 ? `${unread} notifikasi belum dibaca` : "Notifikasi"
      }
      className="relative rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
