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
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"

type DocRow = Database["public"]["Tables"]["documents"]["Row"]
type ItemRow = Database["public"]["Tables"]["document_items"]["Row"]
type Org = Database["public"]["Tables"]["organizations"]["Row"]
type Contact = Database["public"]["Tables"]["contacts"]["Row"]
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
  legal: { marginTop: 10, fontStyle: "italic", color: "#444" },
  footer: { marginTop: 20, color: "#666", fontSize: 8 },
})

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

function partyLines(p: {
  name: string
  street?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  ico?: string | null
  dic?: string | null
  ic_dph?: string | null
}) {
  return (
    <View>
      <Text style={styles.bold}>{p.name}</Text>
      {p.street ? <Text>{p.street}</Text> : null}
      {p.postal_code || p.city ? (
        <Text>{[p.postal_code, p.city].filter(Boolean).join(" ")}</Text>
      ) : null}
      {p.country ? <Text>{p.country}</Text> : null}
      <View style={{ marginTop: 4 }}>
        {p.ico ? <Text>IČO: {p.ico}</Text> : null}
        {p.dic ? <Text>DIČ: {p.dic}</Text> : null}
        {p.ic_dph ? <Text>IČ DPH: {p.ic_dph}</Text> : null}
      </View>
    </View>
  )
}

export function InvoiceDocument({
  document: doc,
  items,
  org,
  contact,
  bank,
  qrDataUrl,
}: {
  document: DocRow
  items: ItemRow[]
  org: Org
  contact: Contact | null
  bank: Bank | null
  qrDataUrl: string | null
}) {
  const currency = doc.currency

  // VAT recapitulation grouped by rate.
  const recapMap = new Map<number, { base: number; vat: number }>()
  for (const it of items) {
    const r = recapMap.get(it.vat_rate) ?? { base: 0, vat: 0 }
    r.base = round2(r.base + it.line_base)
    r.vat = round2(r.vat + it.line_vat)
    recapMap.set(it.vat_rate, r)
  }
  const recap = [...recapMap.entries()].sort((a, b) => b[0] - a[0])

  const title = DOCUMENT_TYPE_LABELS[doc.type as DocumentType] ?? "Doklad"
  const isPaid = doc.status === "paid"

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.between}>
          <View>
            <Text style={styles.h1}>
              {title}
              {doc.number ? ` ${doc.number}` : ""}
            </Text>
            {doc.number ? (
              <Text style={styles.muted}>
                Variabilný symbol: {doc.number.replace(/\D/g, "")}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.bold}>{org.name}</Text>
          </View>
        </View>

        <View style={[styles.between, styles.block]}>
          <View style={styles.party}>
            <Text style={styles.sectionTitle}>Dodávateľ</Text>
            {partyLines(org)}
            {!org.is_vat_payer ? (
              <Text style={{ marginTop: 4 }}>Nie som platiteľ DPH.</Text>
            ) : null}
          </View>
          <View style={styles.party}>
            <Text style={styles.sectionTitle}>Odberateľ</Text>
            {contact ? (
              partyLines(contact)
            ) : (
              <Text style={styles.muted}>—</Text>
            )}
          </View>
        </View>

        <View style={[styles.row, styles.block, { gap: 24 }]}>
          <Text>Dátum vystavenia: {fmtDate(doc.issue_date)}</Text>
          <Text>Dátum dodania (DUZP): {fmtDate(doc.supply_date)}</Text>
          <Text>Splatnosť: {fmtDate(doc.due_date)}</Text>
        </View>

        {/* Items */}
        <View style={styles.block}>
          <View style={styles.th}>
            <Text style={styles.cDesc}>Popis</Text>
            <Text style={styles.cQty}>Množstvo</Text>
            <Text style={styles.cPrice}>Cena/j.</Text>
            <Text style={styles.cVat}>DPH</Text>
            <Text style={styles.cBase}>Základ</Text>
          </View>
          {items.map((it) => (
            <View key={it.id} style={styles.td}>
              <Text style={styles.cDesc}>{it.description || "—"}</Text>
              <Text style={styles.cQty}>
                {it.quantity} {it.unit}
              </Text>
              <Text style={styles.cPrice}>
                {formatMoney(it.unit_price, currency)}
              </Text>
              <Text style={styles.cVat}>{it.vat_rate} %</Text>
              <Text style={styles.cBase}>
                {formatMoney(it.line_base, currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          {recap.map(([rate, r]) => (
            <View key={rate} style={styles.totalRow}>
              <Text style={styles.muted}>
                Základ {rate} % / DPH {rate} %
              </Text>
              <Text>
                {formatMoney(r.base, currency)} / {formatMoney(r.vat, currency)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Základ spolu</Text>
            <Text>{formatMoney(doc.subtotal, currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>DPH spolu</Text>
            <Text>{formatMoney(doc.vat_total, currency)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>Spolu na úhradu</Text>
            <Text>{formatMoney(doc.total, currency)}</Text>
          </View>
        </View>

        {/* Payment + QR */}
        <View style={[styles.between, styles.block]}>
          <View>
            <Text style={styles.sectionTitle}>Platobné údaje</Text>
            {bank?.iban ? <Text>IBAN: {bank.iban}</Text> : null}
            {bank?.swift ? <Text>SWIFT: {bank.swift}</Text> : null}
            {doc.number ? (
              <Text>VS: {doc.number.replace(/\D/g, "")}</Text>
            ) : null}
            <Text>Suma: {formatMoney(doc.total, currency)}</Text>
          </View>
          {qrDataUrl && !isPaid ? (
            <View style={{ alignItems: "center" }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={qrDataUrl} style={styles.qr} />
              <Text style={styles.muted}>Zaplať QR kódom</Text>
            </View>
          ) : null}
        </View>

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
