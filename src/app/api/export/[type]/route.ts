import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { invoiceBalance } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { monthlyRevenue, receivableAging, topClients } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;
  let csv: string;

  switch (type) {
    case "clients": {
      const clients = await prisma.client.findMany({
        orderBy: { name: "asc" },
        include: { contacts: { where: { isPrimary: true }, take: 1 } },
      });
      csv = toCsv(
        [
          "Nama",
          "Perusahaan",
          "Email",
          "Telepon",
          "Status",
          "Kota",
          "Negara",
          "NPWP",
          "Tag",
          "Kontak utama",
        ],
        clients.map((client) => [
          client.name,
          client.company,
          client.email,
          client.phone,
          client.status,
          client.city,
          client.country,
          client.taxId,
          client.tags.join("; "),
          client.contacts[0]?.name ?? "",
        ]),
      );
      break;
    }

    case "invoices": {
      const invoices = await prisma.invoice.findMany({
        orderBy: { issueDate: "desc" },
        include: { client: { select: { name: true } } },
      });
      csv = toCsv(
        [
          "Nomor",
          "Klien",
          "Status",
          "Terbit",
          "Jatuh tempo",
          "Mata uang",
          "Subtotal",
          "Diskon",
          "PPN",
          "PPh 23",
          "Total",
          "Dibayar",
          "Sisa",
        ],
        invoices.map((invoice) => [
          invoice.number,
          invoice.client.name,
          invoice.status,
          invoice.issueDate.toISOString().slice(0, 10),
          invoice.dueDate.toISOString().slice(0, 10),
          invoice.currency,
          invoice.subtotal,
          invoice.discount,
          invoice.taxAmount,
          invoice.withholdingAmount,
          invoice.total,
          invoice.amountPaid,
          invoiceBalance(invoice),
        ]),
      );
      break;
    }

    case "payments": {
      const payments = await prisma.payment.findMany({
        orderBy: { paidAt: "desc" },
        include: {
          invoice: {
            select: { number: true, client: { select: { name: true } } },
          },
        },
      });
      csv = toCsv(
        ["Tanggal", "Invoice", "Klien", "Nominal", "Metode", "Referensi"],
        payments.map((payment) => [
          payment.paidAt.toISOString().slice(0, 10),
          payment.invoice.number,
          payment.invoice.client.name,
          payment.amount,
          payment.method,
          payment.reference,
        ]),
      );
      break;
    }

    case "deals": {
      const deals = await prisma.deal.findMany({
        orderBy: { updatedAt: "desc" },
        include: { client: { select: { name: true } } },
      });
      csv = toCsv(
        ["Judul", "Klien", "Tahap", "Nilai", "Mata uang", "Probabilitas", "Target tutup"],
        deals.map((deal) => [
          deal.title,
          deal.client.name,
          deal.stage,
          deal.value,
          deal.currency,
          deal.probability,
          deal.expectedCloseDate?.toISOString().slice(0, 10) ?? "",
        ]),
      );
      break;
    }

    case "revenue": {
      const rows = await monthlyRevenue(12);
      csv = toCsv(
        ["Bulan", "Tertagih", "Terkumpul"],
        rows.map((row) => [row.label, row.billed, row.collected]),
      );
      break;
    }

    case "aging": {
      const rows = await receivableAging();
      csv = toCsv(
        ["Kelompok umur", "Jumlah invoice", "Nilai"],
        rows.map((row) => [row.label, row.count, row.amount]),
      );
      break;
    }

    case "top-clients": {
      const rows = await topClients(50);
      csv = toCsv(
        ["Klien", "Jumlah invoice", "Tertagih", "Terkumpul", "Piutang"],
        rows.map((row) => [
          row.name,
          row.invoices,
          row.billed,
          row.collected,
          row.outstanding,
        ]),
      );
      break;
    }

    case "expenses": {
      const expenses = await prisma.expense.findMany({
        orderBy: { spentOn: "desc" },
        include: {
          client: { select: { name: true } },
          project: { select: { name: true } },
          invoice: { select: { number: true } },
        },
      });
      csv = toCsv(
        [
          "Tanggal",
          "Keterangan",
          "Kategori",
          "Vendor",
          "Klien",
          "Proyek",
          "Nominal",
          "Mata uang",
          "Kurs",
          "Tagih ulang",
          "Invoice",
        ],
        expenses.map((expense) => [
          expense.spentOn.toISOString().slice(0, 10),
          expense.description,
          expense.category,
          expense.vendor,
          expense.client?.name ?? "",
          expense.project?.name ?? "",
          expense.amount,
          expense.currency,
          expense.exchangeRate,
          expense.billable ? "Ya" : "Tidak",
          expense.invoice?.number ?? "",
        ]),
      );
      break;
    }

    case "efaktur": {
      // A helper for manual e-Faktur entry, not a certified import file.
      const invoices = await prisma.invoice.findMany({
        where: {
          status: { notIn: ["DRAFT", "CANCELLED"] },
          taxAmount: { gt: 0 },
        },
        orderBy: { issueDate: "asc" },
        include: { client: { select: { name: true, taxId: true, address: true, city: true } } },
      });
      csv = toCsv(
        [
          "Nomor invoice",
          "Tanggal faktur",
          "NPWP pembeli",
          "Nama pembeli",
          "Alamat pembeli",
          "DPP",
          "PPN",
          "Tarif PPN (%)",
          "Mata uang",
        ],
        invoices.map((invoice) => [
          invoice.number,
          invoice.issueDate.toISOString().slice(0, 10),
          invoice.client.taxId ?? "",
          invoice.client.name,
          [invoice.client.address, invoice.client.city]
            .filter(Boolean)
            .join(", "),
          Number(invoice.subtotal) - Number(invoice.discount),
          invoice.taxAmount,
          invoice.taxRate,
          invoice.currency,
        ]),
      );
      break;
    }

    case "pph23": {
      const invoices = await prisma.invoice.findMany({
        where: {
          status: { notIn: ["DRAFT", "CANCELLED"] },
          withholdingAmount: { gt: 0 },
        },
        orderBy: { issueDate: "asc" },
        include: { client: { select: { name: true, taxId: true } } },
      });
      csv = toCsv(
        [
          "Nomor invoice",
          "Tanggal",
          "Pemotong",
          "NPWP pemotong",
          "DPP",
          "Tarif PPh 23 (%)",
          "PPh 23 dipotong",
          "Nomor bukti potong",
          "Tanggal bukti potong",
          "Status bukti potong",
        ],
        invoices.map((invoice) => [
          invoice.number,
          invoice.issueDate.toISOString().slice(0, 10),
          invoice.client.name,
          invoice.client.taxId ?? "",
          Number(invoice.subtotal) - Number(invoice.discount),
          invoice.withholdingRate,
          invoice.withholdingAmount,
          invoice.withholdingSlipNumber ?? "",
          invoice.withholdingSlipDate?.toISOString().slice(0, 10) ?? "",
          invoice.withholdingSlipNumber ? "Diterima" : "Belum diterima",
        ]),
      );
      break;
    }

    default:
      return NextResponse.json({ error: "Tipe ekspor tidak dikenal" }, { status: 404 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
