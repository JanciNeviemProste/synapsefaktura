/**
 * Per-document label dictionary for rendered invoices (PDF + detail view).
 *
 * This is intentionally separate from the UI i18n (next-intl): the language of a
 * document follows `documents.language` (the recipient's language), not the
 * logged-in user's interface locale. Defaults to Slovak for unknown languages.
 */

import type { DocumentType } from "./labels"

export type DocLabels = {
  document: string
  invoice: string
  variableSymbol: string
  supplier: string
  customer: string
  notVatPayer: string
  noCustomer: string
  issueDate: string
  supplyDate: string
  dueDate: string
  items: string
  description: string
  qty: string
  unitPrice: string
  vatRate: string
  base: string
  vatBaseRecap: string
  subtotal: string
  vatTotal: string
  toPay: string
  paymentDetails: string
  iban: string
  swift: string
  variableSymbolShort: string
  amount: string
  payByQr: string
  ico: string
  dic: string
  icDph: string
  total: string
  receivedBy: string
  signature: string
  date: string
  /** Nazvy dokladov podla typu - hlavicka dokumentu. Oddelene od popisiek poli. */
  documentTypes: Record<DocumentType, string>
}

const sk: DocLabels = {
  document: "Doklad",
  invoice: "Faktúra",
  variableSymbol: "Variabilný symbol",
  supplier: "Dodávateľ",
  customer: "Odberateľ",
  notVatPayer: "Nie som platiteľ DPH.",
  noCustomer: "Bez odberateľa",
  items: "Položky",
  issueDate: "Dátum vystavenia",
  supplyDate: "Dátum dodania (DUZP)",
  dueDate: "Splatnosť",
  description: "Popis",
  qty: "Množstvo",
  unitPrice: "Cena/j.",
  vatRate: "DPH",
  base: "Základ",
  vatBaseRecap: "Základ / DPH",
  subtotal: "Základ spolu",
  vatTotal: "DPH spolu",
  toPay: "Spolu na úhradu",
  paymentDetails: "Platobné údaje",
  iban: "IBAN",
  swift: "SWIFT",
  variableSymbolShort: "VS",
  amount: "Suma",
  payByQr: "Zaplať QR kódom",
  ico: "IČO",
  dic: "DIČ",
  icDph: "IČ DPH",
  total: "Spolu",
  receivedBy: "Prevzal",
  signature: "Podpis",
  date: "Dátum",
  documentTypes: {
    invoice: "Faktúra",
    proforma: "Proforma / zálohová faktúra",
    advance: "Preddavková faktúra",
    tax_doc_payment: "Daňový doklad k platbe",
    credit_note: "Dobropis",
    quote: "Cenová ponuka",
    order_issued: "Vystavená objednávka",
    order_received: "Prijatá objednávka",
    delivery_note: "Dodací list",
    draft: "Koncept",
  },
}

const cz: DocLabels = {
  document: "Doklad",
  invoice: "Faktura",
  variableSymbol: "Variabilní symbol",
  supplier: "Dodavatel",
  customer: "Odběratel",
  notVatPayer: "Nejsem plátce DPH.",
  noCustomer: "Bez odběratele",
  items: "Položky",
  issueDate: "Datum vystavení",
  supplyDate: "Datum uskutečnění (DUZP)",
  dueDate: "Splatnost",
  description: "Popis",
  qty: "Množství",
  unitPrice: "Cena/j.",
  vatRate: "DPH",
  base: "Základ",
  vatBaseRecap: "Základ / DPH",
  subtotal: "Základ celkem",
  vatTotal: "DPH celkem",
  toPay: "Celkem k úhradě",
  paymentDetails: "Platební údaje",
  iban: "IBAN",
  swift: "SWIFT",
  variableSymbolShort: "VS",
  amount: "Částka",
  payByQr: "Zaplaťte QR kódem",
  ico: "IČO",
  dic: "DIČ",
  icDph: "DIČ (DPH)",
  total: "Celkem",
  receivedBy: "Převzal",
  signature: "Podpis",
  date: "Datum",
  documentTypes: {
    invoice: "Faktura",
    proforma: "Zálohová faktura",
    advance: "Zálohový list",
    tax_doc_payment: "Daňový doklad k platbě",
    credit_note: "Dobropis",
    quote: "Cenová nabídka",
    order_issued: "Vystavená objednávka",
    order_received: "Přijatá objednávka",
    delivery_note: "Dodací list",
    draft: "Koncept",
  },
}

const en: DocLabels = {
  document: "Document",
  invoice: "Invoice",
  variableSymbol: "Variable symbol",
  supplier: "Supplier",
  customer: "Customer",
  notVatPayer: "Not a VAT payer.",
  noCustomer: "No customer",
  items: "Items",
  issueDate: "Issue date",
  supplyDate: "Supply date",
  dueDate: "Due date",
  description: "Description",
  qty: "Qty",
  unitPrice: "Unit price",
  vatRate: "VAT",
  base: "Base",
  vatBaseRecap: "Base / VAT",
  subtotal: "Subtotal",
  vatTotal: "VAT total",
  toPay: "Total due",
  paymentDetails: "Payment details",
  iban: "IBAN",
  swift: "SWIFT",
  variableSymbolShort: "Ref.",
  amount: "Amount",
  payByQr: "Pay by QR code",
  ico: "Company ID",
  dic: "Tax ID",
  icDph: "VAT ID",
  total: "Total",
  receivedBy: "Received by",
  signature: "Signature",
  date: "Date",
  documentTypes: {
    invoice: "Invoice",
    proforma: "Proforma invoice",
    advance: "Advance invoice",
    tax_doc_payment: "Tax document for payment",
    credit_note: "Credit note",
    quote: "Quotation",
    order_issued: "Purchase order",
    order_received: "Sales order",
    delivery_note: "Delivery note",
    draft: "Draft",
  },
}

const DICTS: Record<string, DocLabels> = { sk, cz, en }

/** Returns invoice label strings for the given document language (default `sk`). */
export function docLabels(lang: string | null | undefined): DocLabels {
  return DICTS[(lang ?? "sk").toLowerCase()] ?? sk
}
