import type { ReactNode } from "react";

/** The portal always renders light, even when staff have dark mode on. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="force-light min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
