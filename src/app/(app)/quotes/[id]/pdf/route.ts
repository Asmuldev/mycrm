import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getQuoteView } from "@/lib/invoice-view";
import { quoteStatusLabel } from "@/lib/labels";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const view = await getQuoteView(id);
  if (!view) {
    return NextResponse.json({ error: "Penawaran tidak ditemukan" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    InvoicePdf({
      view,
      docType: "PENAWARAN",
      statusLabel: quoteStatusLabel[view.quoteStatus] ?? view.quoteStatus,
      validityLabel: "Berlaku sampai",
      showPaymentSummary: false,
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${view.invoice.number.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
