import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-session";
import { getPortalData } from "@/lib/portal-data";
import { PortalView } from "../portal-view";
import { clientLogout } from "../portal-actions";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");

  const data = await getPortalData(session.clientId);
  if (!data) redirect("/portal/login");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Masuk sebagai <span className="text-slate-800">{session.name}</span>
        </p>
        <form action={clientLogout}>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Keluar
          </button>
        </form>
      </div>

      <PortalView data={data} linkBase="/portal" />
    </>
  );
}
