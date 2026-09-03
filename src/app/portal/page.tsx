import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-session";

export const dynamic = "force-dynamic";

/** Entry point for account holders; portal links go to /portal/<token>. */
export default async function PortalIndexPage() {
  const session = await getClientSession();
  redirect(session ? "/portal/dashboard" : "/portal/login");
}
