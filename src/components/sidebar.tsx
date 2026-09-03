"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileClock,
  FileMinus,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Repeat,
  ReceiptText,
  ScrollText,
  Settings,
  Target,
  Trash2,
} from "lucide-react";
import { cn } from "@/components/ui";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Klien", icon: Building2 },
  { href: "/deals", label: "Deal", icon: Target },
  { href: "/projects", label: "Proyek", icon: FolderKanban },
  { href: "/quotes", label: "Penawaran", icon: ScrollText },
  { href: "/invoices", label: "Invoice", icon: FileText },
  { href: "/credit-notes", label: "Nota kredit", icon: FileMinus },
  { href: "/recurring", label: "Langganan", icon: Repeat },
  { href: "/expenses", label: "Biaya", icon: ReceiptText },
  { href: "/tasks", label: "Tugas", icon: ListTodo },
  { href: "/calendar", label: "Kalender", icon: CalendarDays },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/audit", label: "Log aktivitas", icon: FileClock },
  { href: "/trash", label: "Sampah", icon: Trash2 },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:px-3 md:py-4">
      {nav.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
