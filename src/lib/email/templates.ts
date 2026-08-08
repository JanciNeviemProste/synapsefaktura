/**
 * i18n-aware email bodies for invoice delivery and reminders. The email follows
 * the DOCUMENT's language (recipient), consistent with the PDF (`documents.language`),
 * not the sender's UI locale. Defaults to Slovak for unknown languages.
 *
 * Pure (no I/O) so it is unit-testable and safe to import anywhere.
 */

type Lang = "sk" | "cz" | "en"

function normLang(lang: string | null | undefined): Lang {
  const l = (lang ?? "sk").toLowerCase()
  return l === "cz" || l === "en" ? (l as Lang) : "sk"
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function wrap(bodyHtml: string, footer: string): string {
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5">`,
    bodyHtml,
    `<hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0" />`,
    `<p style="font-size:12px;color:#888">${esc(footer)}</p>`,
    `</div>`,
  ].join("")
}

const DICT: Record<
  Lang,
  {
    invoiceSubject: (n: string, s: string) => string
    reminderSubject: (n: string) => string
    greeting: (name: string) => string
    invoiceLead: (supplier: string) => string
    invoiceMeta: (n: string, total: string, due: string) => string
    attachedNote: string
    footer: (supplier: string) => string
    labels: { number: string; total: string; due: string }
  }
> = {
  sk: {
    invoiceSubject: (n, s) => `Faktúra ${n} od ${s}`,
    reminderSubject: (n) => `Upomienka k faktúre ${n}`,
    greeting: (name) => (name ? `Dobrý deň, ${name},` : "Dobrý deň,"),
    invoiceLead: (supplier) =>
      `v prílohe vám zasielame faktúru od spoločnosti ${supplier}.`,
    invoiceMeta: (n, total, due) =>
      `Faktúra ${n}, suma ${total}, splatnosť ${due}.`,
    attachedNote: "Faktúru nájdete v PDF prílohe tohto e-mailu.",
    footer: (supplier) =>
      `Tento e-mail odoslal ${supplier} cez Synapse Faktúra.`,
    labels: { number: "Číslo", total: "Suma", due: "Splatnosť" },
  },
  cz: {
    invoiceSubject: (n, s) => `Faktura ${n} od ${s}`,
    reminderSubject: (n) => `Upomínka k faktuře ${n}`,
    greeting: (name) => (name ? `Dobrý den, ${name},` : "Dobrý den,"),
    invoiceLead: (supplier) =>
      `v příloze vám zasíláme fakturu od společnosti ${supplier}.`,
    invoiceMeta: (n, total, due) =>
      `Faktura ${n}, částka ${total}, splatnost ${due}.`,
    attachedNote: "Fakturu najdete v PDF příloze tohoto e-mailu.",
    footer: (supplier) =>
      `Tento e-mail odeslal ${supplier} přes Synapse Faktúra.`,
    labels: { number: "Číslo", total: "Částka", due: "Splatnost" },
  },
  en: {
    invoiceSubject: (n, s) => `Invoice ${n} from ${s}`,
    reminderSubject: (n) => `Payment reminder for invoice ${n}`,
    greeting: (name) => (name ? `Dear ${name},` : "Hello,"),
    invoiceLead: (supplier) =>
      `please find attached the invoice from ${supplier}.`,
    invoiceMeta: (n, total, due) =>
      `Invoice ${n}, amount ${total}, due ${due}.`,
    attachedNote: "The invoice is attached to this email as a PDF.",
    footer: (supplier) =>
      `This email was sent by ${supplier} via Synapse Faktúra.`,
    labels: { number: "Number", total: "Amount", due: "Due date" },
  },
}

export type InvoiceEmailInput = {
  lang: string | null | undefined
  docNumber: string
  supplierName: string
  customerName?: string | null
  total: string
  dueDate: string
}

/** Subject + HTML for delivering an invoice (PDF attached separately). */
export function invoiceEmail(input: InvoiceEmailInput): {
  subject: string
  html: string
} {
  const t = DICT[normLang(input.lang)]
  const subject = t.invoiceSubject(input.docNumber, input.supplierName)
  const body = [
    `<p>${esc(t.greeting(input.customerName ?? ""))}</p>`,
    `<p>${esc(t.invoiceLead(input.supplierName))}</p>`,
    `<p><strong>${esc(t.labels.number)}:</strong> ${esc(input.docNumber)}<br/>`,
    `<strong>${esc(t.labels.total)}:</strong> ${esc(input.total)}<br/>`,
    `<strong>${esc(t.labels.due)}:</strong> ${esc(input.dueDate)}</p>`,
    `<p>${esc(t.attachedNote)}</p>`,
  ].join("")
  return { subject, html: wrap(body, t.footer(input.supplierName)) }
}

export type ReminderEmailInput = {
  lang: string | null | undefined
  docNumber: string
  supplierName: string
  /** Pre-composed reminder body text (from smartReminderBody). */
  body: string
}

/** Subject + HTML for a payment reminder (body already composed elsewhere). */
export function reminderEmail(input: ReminderEmailInput): {
  subject: string
  html: string
} {
  const t = DICT[normLang(input.lang)]
  const subject = t.reminderSubject(input.docNumber)
  const paragraphs = input.body
    .split(/\n{2,}|\n/)
    .filter((p) => p.trim())
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join("")
  return { subject, html: wrap(paragraphs, t.footer(input.supplierName)) }
}
