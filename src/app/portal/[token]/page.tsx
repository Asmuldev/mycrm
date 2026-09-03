import { notFound } from "next/navigation";
import { getPortalData } from "@/lib/portal-data";
import { resolvePortalToken, touchPortalToken } from "@/lib/portal";
import { PortalView } from "../portal-view";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portal = await resolvePortalToken(token);
  if (!portal) notFound();

  await touchPortalToken(portal.id);

  const data = await getPortalData(portal.clientId);
  if (!data) notFound();

  return (
    <>
      <PortalView data={data} linkBase={`/portal/${token}`} />

      <p className="mt-6 text-center text-xs text-slate-400">
        Tautan ini pribadi. Jangan dibagikan ke pihak lain.
      </p>
    </>
  );
}
