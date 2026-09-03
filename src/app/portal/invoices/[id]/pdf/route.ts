import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-session";
import { getInvoiceView } from "@/lib/invoice-view";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const view = await getInvoiceView(id);

  // A signed-in client must not be able to read another client's invoice.
  if (!view || view.invoice.clientOwnerId !== session.clientId) {
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
