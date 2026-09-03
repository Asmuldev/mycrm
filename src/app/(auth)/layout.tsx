import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            CRM
          </div>
          <h1 className="text-lg font-semibold text-slate-900">My CRM</h1>
          <p className="text-sm text-slate-500">
            Klien, deal, tugas, dan invoice dalam satu tempat
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
