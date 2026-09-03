import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvoiceView } from "@/lib/invoice-view";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const view = await getInvoiceView(id);
  if (!view) {
    return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  }

  const buffer = await renderToBuffer(InvoicePdf({ view }));
  const filename = `${view.invoice.number.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
