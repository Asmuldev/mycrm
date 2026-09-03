import type { ReactNode } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
            CRM
          </div>
          <span className="text-sm font-semibold text-slate-900">My CRM</span>
        </div>
        <div className="flex items-center gap-3">
          <CommandPalette />
          <NotificationBell userId={session.userId} />
          <ThemeToggle />
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-slate-800">{session.name}</p>
            <p className="text-[11px] text-slate-500">{session.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Keluar
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col md:flex-row">
        <aside className="no-print border-b border-slate-200 bg-white md:min-h-[calc(100vh-57px)] md:w-56 md:shrink-0 md:border-b-0 md:border-r">
          <Sidebar />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
