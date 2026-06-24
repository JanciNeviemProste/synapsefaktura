export const DOCUMENT_TYPE_LABELS = {
  invoice: "Faktúra",
  proforma: "Proforma / zálohová",
  advance: "Preddavková faktúra",
  tax_doc_payment: "Daňový doklad k platbe",
  credit_note: "Dobropis",
  quote: "Cenová ponuka",
  order_issued: "Vystavená objednávka",
  order_received: "Prijatá objednávka",
  delivery_note: "Dodací list",
  draft: "Koncept",
} as const

export type DocumentType = keyof typeof DOCUMENT_TYPE_LABELS

export const DOCUMENT_STATUS_LABELS = {
  draft: "Koncept",
  issued: "Vystavená",
  sent: "Odoslaná",
  partially_paid: "Čiastočne uhradená",
  paid: "Uhradená",
  overdue: "Po splatnosti",
  cancelled: "Stornovaná",
} as const

export type DocumentStatus = keyof typeof DOCUMENT_STATUS_LABELS
