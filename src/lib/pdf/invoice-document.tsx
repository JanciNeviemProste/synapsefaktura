import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney, round2 } from "@/lib/money"
import { type DocumentType } from "@/lib/documents/labels"
import { docLabels } from "@/lib/documents/doc-labels"
import {
  documentPresentation,
  type DocumentPresentation,
} from "@/lib/documents/presentation"
import type { ClientDetails } from "@/lib/documents/client-details"

type DocRow = Database["public"]["Tables"]["documents"]["Row"]
type ItemRow = Database["public"]["Tables"]["document_items"]["Row"]
type Org = Database["public"]["Tables"]["organizations"]["Row"]
type Bank = Database["public"]["Tables"]["bank_accounts"]["Row"]

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1a1a1a", fontFamily: "Helvetica" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  muted: { color: "#666" },
  bold: { fontFamily: "Helvetica-Bold" },
  party: { width: "48%" },
  sectionTitle: {
    fontSize: 8,
    color: "#888",
    marginBottom: 3,
    textTransform: "uppercase",
  },
  block: { marginTop: 16 },
  th: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  td: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 3,
  },
  cDesc: { width: "40%" },
  cQty: { width: "12%", textAlign: "right" },
  cPrice: { width: "16%", textAlign: "right" },
  cVat: { width: "12%", textAlign: "right" },
  cBase: { width: "20%", textAlign: "right" },
  // Bez cien ostanu len dva stlpce, tak zaberu celu sirku.
  cDescWide: { width: "70%" },
  cQtyWide: { width: "30%", textAlign: "right" },
  totalsBox: { marginTop: 12, alignSelf: "flex-end", width: "55%" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#333",
    marginTop: 3,
    paddingTop: 3,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  qr: { width: 110, height: 110 },
  // Sirku obrazkov dopocita renderer z pomeru stran - staci zadat vysku a
  // strop, aby velke logo neroztlacilo hlavicku.
  logo: { height: 34, maxWidth: 150, marginBottom: 4 },
  supplierMark: {
    marginTop: 24,
    alignSelf: "flex-end",
    width: "45%",
    alignItems: "center",
  },
  supplierMarkImages: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    marginBottom: 2,
  },
  supplierStamp: { height: 58, maxWidth: 100 },
  supplierSignature: { height: 42, maxWidth: 130 },
  supplierMarkCaption: {
    width: "100%",
    borderTopWidth: 0.5,
    borderTopColor: "#333",
    paddingTop: 3,
    textAlign: "center",
  },
  signatures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  signatureLine: {
    width: "40%",
    borderTopWidth: 0.5,
    borderTopColor: "#333",
    paddingTop: 3,
  },
  legal: { marginTop: 10, fontStyle: "italic", color: "#444" },
  footer: { marginTop: 20, color: "#666", fontSize: 8 },
})

/**
 * Ma doklad zniest podpis a peciatku dodavatela?
 *
 * Dodaci list uz ma vlastny blok na podpis prevzatia (`signatureArea`), takze
 * podpis dodavatela by sa s nim bil - tam ho vynechavame. Zvysok dokladov, ktore
 * nieco tvrdia o cene (faktura, ponuka, objednavka, dobropis), ho unesie.
 * Exportovane, aby render.tsx zbytocne nestahoval obrazky, ktore sa nevykreslia.
 */
export function showsSupplierMark(p: DocumentPresentation): boolean {
  return p.showPrices && !p.signatureArea
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

function partyLines(
  p: {
    name: string
    street?: string | null
    postal_code?: string | null
    city?: string | null
    country?: string | null
    ico?: string | null
    dic?: string | null
    ic_dph?: string | null
  },
  L: ReturnType<typeof docLabels>,
) {
  return (
    <View>
      <Text style={styles.bold}>{p.name}</Text>
      {p.street ? <Text>{p.street}</Text> : null}
      {p.postal_code || p.city ? (
        <Text>{[p.postal_code, p.city].filter(Boolean).join(" ")}</Text>
      ) : null}
      {p.country ? <Text>{p.country}</Text> : null}
      <View style={{ marginTop: 4 }}>
        {p.ico ? (
          <Text>
            {L.ico}: {p.ico}
          </Text>
        ) : null}
        {p.dic ? (
          <Text>
            {L.dic}: {p.dic}
          </Text>
        ) : null}
        {p.ic_dph ? (
          <Text>
            {L.icDph}: {p.ic_dph}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export function InvoiceDocument({
  document: doc,
  items,
  org,
  client,
  bank,
  qrDataUrl,
  logoDataUrl = null,
  signatureDataUrl = null,
  stampDataUrl = null,
}: {
  document: DocRow
  items: ItemRow[]
  org: Org
  /** Udaje odberatela uz vybrate cez `resolveClientDetails` — na doklade musia
   *  byt tie, ktore platili pri vystaveni, nie aktualny stav kontaktu. */
  client: ClientDetails | null
  bank: Bank | null
  qrDataUrl: string | null
  /** Firemne obrazky ako data URI - render.tsx ich stiahne vopred, aby
   *  nedostupny Supabase Storage nezhodil generovanie PDF. */
  logoDataUrl?: string | null
  signatureDataUrl?: string | null
  stampDataUrl?: string | null
}) {
  const currency = doc.currency
  const L = docLabels(doc.language)
  const p = documentPresentation(doc.type as DocumentType, {
    showPrices: doc.show_prices,
    showQr: doc.show_qr_payment,
    signatureArea: doc.show_signature,
  })

  // VAT recapitulation grouped by rate.
  const recapMap = new Map<number, { base: number; vat: number }>()
  if (p.showVatRecap) {
    for (const it of items) {
      const r = recapMap.get(it.vat_rate) ?? { base: 0, vat: 0 }
      r.base = round2(r.base + it.line_base)
      r.vat = round2(r.vat + it.line_vat)
      recapMap.set(it.vat_rate, r)
    }
  }
  const recap = [...recapMap.entries()].sort((a, b) => b[0] - a[0])

  const title = L.documentTypes[doc.type as DocumentType] ?? L.document
  const isPaid = doc.status === "paid"
  const showQr = p.showQr && !isPaid
  const supplierMark =
    showsSupplierMark(p) && (signatureDataUrl || stampDataUrl)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.between}>
          <View>
            <Text style={styles.h1}>
              {title}
              {doc.number ? ` ${doc.number}` : ""}
            </Text>
            {p.showVariableSymbol && doc.number ? (
              <Text style={styles.muted}>
                {L.variableSymbol}: {doc.number.replace(/\D/g, "")}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {/* Bez loga ostava hlavicka presne taka, aka bola. */}
            {logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoDataUrl} style={styles.logo} />
            ) : null}
            <Text style={styles.bold}>{org.name}</Text>
          </View>
        </View>

        <View style={[styles.between, styles.block]}>
          <View style={styles.party}>
            <Text style={styles.sectionTitle}>{L.supplier}</Text>
            {partyLines(org, L)}
            {!org.is_vat_payer ? (
              <Text style={{ marginTop: 4 }}>{L.notVatPayer}</Text>
            ) : null}
          </View>
          <View style={styles.party}>
            <Text style={styles.sectionTitle}>{L.customer}</Text>
            {client ? (
              partyLines(client, L)
            ) : (
              <Text style={styles.muted}>—</Text>
            )}
          </View>
        </View>

        <View style={[styles.row, styles.block, { gap: 24 }]}>
          <Text>
            {L.issueDate}: {fmtDate(doc.issue_date)}
          </Text>
          <Text>
            {L.supplyDate}: {fmtDate(doc.supply_date)}
          </Text>
          <Text>
            {L.dueDate}: {fmtDate(doc.due_date)}
          </Text>
        </View>

        {/* Items */}
        <View style={styles.block}>
          <View style={styles.th}>
            <Text style={p.showPrices ? styles.cDesc : styles.cDescWide}>
              {L.description}
            </Text>
            <Text style={p.showPrices ? styles.cQty : styles.cQtyWide}>
              {L.qty}
            </Text>
            {p.showPrices ? (
              <>
                <Text style={styles.cPrice}>{L.unitPrice}</Text>
                <Text style={styles.cVat}>{L.vatRate}</Text>
                <Text style={styles.cBase}>{L.base}</Text>
              </>
            ) : null}
          </View>
          {items.map((it) => (
            <View key={it.id} style={styles.td}>
              <Text style={p.showPrices ? styles.cDesc : styles.cDescWide}>
                {it.description || "—"}
              </Text>
              <Text style={p.showPrices ? styles.cQty : styles.cQtyWide}>
                {it.quantity} {it.unit}
              </Text>
              {p.showPrices ? (
                <>
                  <Text style={styles.cPrice}>
                    {formatMoney(it.unit_price, currency)}
                  </Text>
                  <Text style={styles.cVat}>{it.vat_rate} %</Text>
                  <Text style={styles.cBase}>
                    {formatMoney(it.line_base, currency)}
                  </Text>
                </>
              ) : null}
            </View>
          ))}
        </View>

        {/* Totals */}
        {p.showPrices ? (
          <View style={styles.totalsBox}>
            {p.showVatRecap ? (
              <>
                {recap.map(([rate, r]) => (
                  <View key={rate} style={styles.totalRow}>
                    <Text style={styles.muted}>
                      {L.base} {rate} % / {L.vatRate} {rate} %
                    </Text>
                    <Text>
                      {formatMoney(r.base, currency)} /{" "}
                      {formatMoney(r.vat, currency)}
                    </Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>{L.subtotal}</Text>
                  <Text>{formatMoney(doc.subtotal, currency)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.muted}>{L.vatTotal}</Text>
                  <Text>{formatMoney(doc.vat_total, currency)}</Text>
                </View>
              </>
            ) : null}
            <View style={styles.grandTotal}>
              <Text>{L[p.totalLabelKey]}</Text>
              <Text>{formatMoney(doc.total, currency)}</Text>
            </View>
          </View>
        ) : null}

        {/* Payment + QR */}
        {p.showPaymentBlock ? (
          <View style={[styles.between, styles.block]}>
            <View>
              <Text style={styles.sectionTitle}>{L.paymentDetails}</Text>
              {bank?.iban ? (
                <Text>
                  {L.iban}: {bank.iban}
                </Text>
              ) : null}
              {bank?.swift ? (
                <Text>
                  {L.swift}: {bank.swift}
                </Text>
              ) : null}
              {p.showVariableSymbol && doc.number ? (
                <Text>
                  {L.variableSymbolShort}: {doc.number.replace(/\D/g, "")}
                </Text>
              ) : null}
              <Text>
                {L.amount}: {formatMoney(doc.total, currency)}
              </Text>
            </View>
            {showQr && qrDataUrl ? (
              <View style={{ alignItems: "center" }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={qrDataUrl} style={styles.qr} />
                <Text style={styles.muted}>{L.payByQr}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Podpis a peciatka dodavatela - nie na doklade s blokom prevzatia. */}
        {supplierMark ? (
          <View style={styles.supplierMark}>
            <View style={styles.supplierMarkImages}>
              {stampDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={stampDataUrl} style={styles.supplierStamp} />
              ) : null}
              {signatureDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image
                  src={signatureDataUrl}
                  style={styles.supplierSignature}
                />
              ) : null}
            </View>
            <Text style={[styles.muted, styles.supplierMarkCaption]}>
              {L.signature}
            </Text>
          </View>
        ) : null}

        {/* Prevzatie - dodaci list sa podpisuje pri odovzdani. */}
        {p.signatureArea ? (
          <View style={styles.signatures}>
            <View style={styles.signatureLine}>
              <Text style={styles.muted}>{L.receivedBy}</Text>
            </View>
            <View style={styles.signatureLine}>
              <Text style={styles.muted}>{L.date}</Text>
            </View>
          </View>
        ) : null}

        {doc.legal_notes ? (
          <Text style={styles.legal}>{doc.legal_notes}</Text>
        ) : null}
        {doc.notes ? <Text style={styles.footer}>{doc.notes}</Text> : null}
        {doc.footer_notes ? (
          <Text style={styles.footer}>{doc.footer_notes}</Text>
        ) : null}
      </Page>
    </Document>
  )
}
