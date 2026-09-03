import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-session";
import { getCompanyProfile } from "@/lib/invoice";
import { getPortalInvoice } from "@/lib/portal-data";
import { PortalInvoiceView } from "../../invoice-view";

export const dynamic = "force-dynamic";

export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getClientSession();
  if (!session) redirect("/portal/login");

  const { id } = await params;
  const [invoice, profile] = await Promise.all([
    getPortalInvoice(session.clientId, id),
    getCompanyProfile(),
  ]);
  if (!invoice) notFound();

  return (
    <PortalInvoiceView
      invoice={invoice}
      linkBase="/portal"
      token={null}
      accent={profile.accentColor}
      bank={{
        name: profile.bankName,
        account: profile.bankAccount,
        holder: profile.bankHolder,
      }}
    />
  );
}
