import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getInvoiceView } from "@/lib/invoice-view";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";
import { resolvePortalToken } from "@/lib/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;

  const portal = await resolvePortalToken(token);
  if (!portal) {
    return NextResponse.json({ error: "Tautan tidak valid" }, { status: 404 });
  }

  const view = await getInvoiceView(id);
  // A valid token must not be able to read another client's invoice.
  if (!view || view.invoice.clientOwnerId !== portal.clientId) {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }
  if (view.invoice.status === "DRAFT") {
    return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  }

  const buffer = await renderToBuffer(InvoicePdf({ view }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${view.invoice.number.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
