import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceStatusLabel } from "@/lib/labels";
import {
  clientAddressLines,
  companyAddressLines,
  type InvoiceView,
} from "@/lib/invoice-view";

// Default hyphenation breaks Indonesian words mid-syllable ("diter-bitkan").
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 0,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1e293b",
  },
  accentBar: { height: 6 },
  body: { paddingHorizontal: 44, paddingTop: 32 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  logo: { width: 108, maxHeight: 48, objectFit: "contain", marginBottom: 10 },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  muted: { color: "#64748b" },
  invoiceTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    textAlign: "right",
  },
  invoiceNumber: { fontSize: 10, textAlign: "right", color: "#475569", marginTop: 2 },
  statusPill: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 10,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  metaRow: { flexDirection: "row", marginTop: 24, justifyContent: "space-between" },
  metaBox: { width: 300 },
  metaLabel: {
    fontSize: 7,
    letterSpacing: 1,
    color: "#94a3b8",
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  strong: { fontFamily: "Helvetica-Bold", color: "#0f172a" },
  datesBox: {
    width: 180,
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 12,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  tableHead: {
    flexDirection: "row",
    marginTop: 24,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  th: { fontSize: 7.5, letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  trAlt: { backgroundColor: "#f8fafc" },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 46, textAlign: "right" },
  colPrice: { width: 92, textAlign: "right" },
  colAmount: { width: 100, textAlign: "right" },
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  totals: { width: 250 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  grandTotalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  grandTotalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  panels: { flexDirection: "row", marginTop: 22 },
  panel: {
    width: "48%",
    marginRight: "4%",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 12,
  },
  panelLast: { marginRight: 0 },
  panelTitle: {
    fontSize: 7,
    letterSpacing: 1,
    color: "#94a3b8",
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 44,
    right: 44,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#94a3b8",
  },
});

const statusTone: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "#e2e8f0", text: "#475569" },
  SENT: { bg: "#e0f2fe", text: "#0369a1" },
  PARTIAL: { bg: "#fef3c7", text: "#b45309" },
  PAID: { bg: "#d1fae5", text: "#047857" },
  OVERDUE: { bg: "#ffe4e6", text: "#be123c" },
  CANCELLED: { bg: "#e2e8f0", text: "#64748b" },
};

export function InvoicePdf({
  view,
  docType = "INVOICE",
  statusLabel,
  validityLabel,
  showPaymentSummary = true,
}: {
  view: InvoiceView;
  docType?: string;
  statusLabel?: string;
  validityLabel?: string;
  showPaymentSummary?: boolean;
}) {
  const { company, invoice, client, items, payments, schedules } = view;
  const accent = company.accentColor || "#0f172a";
  const currency = invoice.currency;
  const tone = statusTone[invoice.status] ?? statusTone.DRAFT;

  return (
    <Document
      title={`${docType} ${invoice.number}`}
      author={company.name}
      subject={`Invoice untuk ${client.name}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} fixed />

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={{ maxWidth: 260 }}>
              {company.logoUrl ? (
                // react-pdf's Image renders into a PDF, not the DOM — it has no
                // alt prop and the DOM a11y rule does not apply.
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={styles.logo} src={company.logoUrl} />
              ) : null}
              <Text style={styles.companyName}>{company.name}</Text>
              <Text style={styles.muted}>
                {companyAddressLines(company).join("\n")}
              </Text>
            </View>

            <View>
              <Text style={[styles.invoiceTitle, { color: accent }]}>
                {docType}
              </Text>
              <Text style={styles.invoiceNumber}>{invoice.number}</Text>
              <Text
                style={[
                  styles.statusPill,
                  { backgroundColor: tone.bg, color: tone.text },
                ]}
              >
                {(
                  statusLabel ??
                  invoiceStatusLabel[invoice.status] ??
                  invoice.status
                ).toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>DITAGIHKAN KEPADA</Text>
              <Text style={[styles.strong, { fontSize: 11, marginBottom: 3 }]}>
                {client.name}
              </Text>
              <Text style={styles.muted}>
                {clientAddressLines(client).join("\n")}
              </Text>
            </View>

            <View style={styles.datesBox}>
              <View style={styles.dateRow}>
                <Text style={styles.muted}>Tanggal terbit</Text>
                <Text style={styles.strong}>{formatDate(invoice.issueDate)}</Text>
              </View>
              <View style={styles.dateRow}>
                <Text style={styles.muted}>{validityLabel ?? "Jatuh tempo"}</Text>
                <Text style={styles.strong}>{formatDate(invoice.dueDate)}</Text>
              </View>
              <View style={[styles.dateRow, { marginBottom: 0 }]}>
                <Text style={styles.muted}>Mata uang</Text>
                <Text style={styles.strong}>{currency}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.tableHead, { backgroundColor: accent }]}>
            <Text style={[styles.th, styles.colDesc, { color: "#ffffff" }]}>
              DESKRIPSI
            </Text>
            <Text style={[styles.th, styles.colQty, { color: "#ffffff" }]}>QTY</Text>
            <Text style={[styles.th, styles.colPrice, { color: "#ffffff" }]}>
              HARGA
            </Text>
            <Text style={[styles.th, styles.colAmount, { color: "#ffffff" }]}>
              JUMLAH
            </Text>
          </View>

          {items.map((item, index) => (
            <View
              key={item.id}
              style={[styles.tr, index % 2 === 1 ? styles.trAlt : {}]}
              wrap={false}
            >
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatMoney(item.unitPrice, currency)}
              </Text>
              <Text style={[styles.colAmount, styles.strong]}>
                {formatMoney(item.amount, currency)}
              </Text>
            </View>
          ))}

          <View style={styles.totalsWrap}>
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.muted}>Subtotal</Text>
                <Text>{formatMoney(invoice.subtotal, currency)}</Text>
              </View>
              {invoice.discount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>Diskon</Text>
                  <Text>-{formatMoney(invoice.discount, currency)}</Text>
                </View>
              ) : null}
              <View style={styles.totalRow}>
                <Text style={styles.muted}>PPN ({invoice.taxRate}%)</Text>
                <Text>{formatMoney(invoice.taxAmount, currency)}</Text>
              </View>
              {invoice.withholdingAmount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>
                    PPh 23 ({invoice.withholdingRate}%)
                  </Text>
                  <Text>-{formatMoney(invoice.withholdingAmount, currency)}</Text>
                </View>
              ) : null}

              <View style={[styles.grandTotal, { backgroundColor: accent }]}>
                <Text style={styles.grandTotalLabel}>TOTAL</Text>
                <Text style={styles.grandTotalValue}>
                  {formatMoney(invoice.total, currency)}
                </Text>
              </View>

              {showPaymentSummary ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.muted}>Sudah dibayar</Text>
                    <Text>{formatMoney(invoice.amountPaid, currency)}</Text>
                  </View>
                  <View style={styles.balanceRow}>
                    <Text style={styles.strong}>Sisa tagihan</Text>
                    <Text style={[styles.strong, { fontSize: 11 }]}>
                      {formatMoney(invoice.balance, currency)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
          </View>

          {schedules.length > 0 ? (
            <View style={{ marginTop: 20 }} wrap={false}>
              <Text style={styles.metaLabel}>JADWAL PEMBAYARAN</Text>
              {schedules.map((schedule) => (
                <View
                  key={schedule.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 3,
                  }}
                >
                  <Text style={styles.muted}>
                    {schedule.label} · jatuh tempo {formatDate(schedule.dueDate)}
                    {schedule.paidAt ? " · lunas" : ""}
                  </Text>
                  <Text>{formatMoney(schedule.amount, currency)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {payments.length > 0 ? (
            <View style={{ marginTop: 20 }} wrap={false}>
              <Text style={styles.metaLabel}>RIWAYAT PEMBAYARAN</Text>
              {payments.map((payment) => (
                <View
                  key={payment.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 3,
                  }}
                >
                  <Text style={styles.muted}>
                    {formatDate(payment.paidAt)} · {payment.method}
                    {payment.reference ? ` · ${payment.reference}` : ""}
                  </Text>
                  <Text>{formatMoney(payment.amount, currency)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.panels} wrap={false}>
            {company.bankName || company.bankAccount ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>PEMBAYARAN KE</Text>
                {company.bankName ? (
                  <Text style={styles.strong}>{company.bankName}</Text>
                ) : null}
                {company.bankAccount ? (
                  <Text style={{ marginTop: 2 }}>{company.bankAccount}</Text>
                ) : null}
                {company.bankHolder ? (
                  <Text style={styles.muted}>a.n. {company.bankHolder}</Text>
                ) : null}
              </View>
            ) : null}

            {invoice.notes || invoice.terms ? (
              <View style={[styles.panel, styles.panelLast]}>
                <Text style={styles.panelTitle}>CATATAN</Text>
                {invoice.notes ? <Text>{invoice.notes}</Text> : null}
                {invoice.terms ? (
                  <Text style={[styles.muted, { marginTop: 4 }]}>
                    {invoice.terms}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {company.name} · {invoice.number}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Halaman ${pageNumber} dari ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
