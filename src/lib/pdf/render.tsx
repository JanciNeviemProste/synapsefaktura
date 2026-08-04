import "server-only"

import { renderToBuffer } from "@react-pdf/renderer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { InvoiceDocument } from "@/lib/pdf/invoice-document"
import { paymentQrDataUrl } from "@/lib/qr/payment-qr"
import { documentPresentation } from "@/lib/documents/presentation"
import type { DocumentType } from "@/lib/documents/labels"

type Db = SupabaseClient<Database>
type DocRow = Database["public"]["Tables"]["documents"]["Row"]
type Contact = Database["public"]["Tables"]["contacts"]["Row"]
type Org = Database["public"]["Tables"]["organizations"]["Row"]

export type RenderedInvoice = {
  buffer: Buffer
  doc: DocRow
  contact: Contact | null
  org: Org
}

/**
 * Fetches a document with everything the invoice PDF needs and renders it to a
 * Buffer. Shared by the PDF download route and email delivery so the layout and
 * data-fetching stay in one place. Returns null when the document/org is missing.
 * Respects RLS via the passed client (use the user client for org-scoped access).
 */
export async function renderInvoicePdf(
  db: Db,
  id: string,
): Promise<RenderedInvoice | null> {
  const [{ data: doc }, { data: items }, { data: org }, { data: bank }] =
    await Promise.all([
      db.from("documents").select("*").eq("id", id).maybeSingle(),
      db
        .from("document_items")
        .select("*")
        .eq("document_id", id)
        .order("position"),
      db.from("organizations").select("*").limit(1).maybeSingle(),
      db
        .from("bank_accounts")
        .select("*")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (!doc || !org) return null

  const { data: contact } = doc.contact_id
    ? await db.from("contacts").select("*").eq("id", doc.contact_id).maybeSingle()
    : { data: null }

  // QR generujeme len pre doklady, ktore su vyzvou na uhradu. Bez tejto
  // podmienky by sa PAY by square pocital aj pre dodaci list a cenovu ponuku —
  // PDF ho tam uz nevykresli, ale praca aj tak prebehne.
  const qrDataUrl =
    documentPresentation(doc.type as DocumentType).showQr &&
    bank?.iban &&
    doc.status !== "paid"
      ? await paymentQrDataUrl({
          iban: bank.iban,
          amount: doc.total,
          currency: doc.currency,
          variableSymbol: doc.number?.replace(/\D/g, "") ?? null,
          note: doc.number ?? null,
          dueDate: doc.due_date,
          customerCountry: contact?.country ?? null,
          beneficiaryName: org.name,
        })
      : null

  const buffer = await renderToBuffer(
    <InvoiceDocument
      document={doc}
      items={items ?? []}
      org={org}
      contact={contact}
      bank={bank}
      qrDataUrl={qrDataUrl}
    />,
  )

  return { buffer, doc, contact, org }
}
