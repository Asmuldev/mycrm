import { notFound } from "next/navigation";
import { getCompanyProfile } from "@/lib/invoice";
import { getPortalInvoice } from "@/lib/portal-data";
import { resolvePortalToken } from "@/lib/portal";
import { PortalInvoiceView } from "../../../invoice-view";

export const dynamic = "force-dynamic";

export default async function TokenInvoicePage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;

  const portal = await resolvePortalToken(token);
  if (!portal) notFound();

  const [invoice, profile] = await Promise.all([
    getPortalInvoice(portal.clientId, id),
    getCompanyProfile(),
  ]);
  if (!invoice) notFound();

  return (
    <PortalInvoiceView
      invoice={invoice}
      linkBase={`/portal/${token}`}
      token={token}
      accent={profile.accentColor}
      bank={{
        name: profile.bankName,
        account: profile.bankAccount,
        holder: profile.bankHolder,
      }}
    />
  );
}
