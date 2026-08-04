import "server-only"

import { renderToBuffer } from "@react-pdf/renderer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { InvoiceDocument, showsSupplierMark } from "@/lib/pdf/invoice-document"
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

/** Rozpocet na stiahnutie jedneho firemneho obrazka (logo/podpis/peciatka). */
const IMAGE_TIMEOUT_MS = 2500
/** Nad tuto velkost obrazok ignorujeme - do hlavicky faktury nepatri. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

/**
 * Rozpozna format podla magickych bajtov, nie podla content-type hlavicky.
 * Storage vie vratit `application/octet-stream` a naopak pri zlom content-type
 * by sa do PDF dostal napr. SVG/WebP, ktore pdfkit nevie vlozit a vyhodil by
 * vynimku uprostred renderu.
 */
function imageMime(bytes: Buffer): "image/png" | "image/jpeg" | null {
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png"
  }
  if (
    bytes.length > 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg"
  }
  return null
}

/**
 * Stiahne obrazok z URL (Supabase Storage) a vrati ho ako data URI.
 * Stahujeme ho tu, nie v @react-pdf/renderer: renderer by siahal na siet bez
 * timeoutu az pocas layoutu, takze nedostupny bucket by drzal generovanie PDF
 * — a to iste PDF sa priklada k odosielanej fakture (markAsSent). Kazde
 * zlyhanie preto konci ako `null` a doklad sa vykresli bez obrazka.
 */
async function imageDataUrl(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
      cache: "no-store",
    })
    if (!res.ok) return null
    const declared = Number(res.headers.get("content-length"))
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_IMAGE_BYTES) return null
    const mime = imageMime(bytes)
    if (!mime) return null
    return `data:${mime};base64,${bytes.toString("base64")}`
  } catch {
    return null
  }
}

/**
 * Fetches a document with everything the invoice PDF needs and renders it to a
 * Buffer. Shared by the PDF download route and email delivery so the layout and
 * data-fetching stay in one place. Returns null when the document/org is missing.
 * Respects RLS via the passed client (use the user client for org-scoped access).
 *
 * `orgId` je POVINNE pri service-role klientovi (cron): ten obchadza RLS, takze
 * bez filtra by `limit(1)` vratil lubovolnu organizaciu a do PDF by sa dostala
 * hlavicka a IBAN cudzej firmy.
 */
export async function renderInvoicePdf(
  db: Db,
  id: string,
  orgId?: string,
): Promise<RenderedInvoice | null> {
  const orgQuery = db.from("organizations").select("*")
  const bankQuery = db.from("bank_accounts").select("*")

  const [{ data: doc }, { data: items }, { data: org }, { data: bank }] =
    await Promise.all([
      db.from("documents").select("*").eq("id", id).maybeSingle(),
      db
        .from("document_items")
        .select("*")
        .eq("document_id", id)
        .order("position"),
      (orgId ? orgQuery.eq("id", orgId) : orgQuery).limit(1).maybeSingle(),
      (orgId ? bankQuery.eq("organization_id", orgId) : bankQuery)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (!doc || !org) return null

  const { data: contact } = doc.contact_id
    ? await db.from("contacts").select("*").eq("id", doc.contact_id).maybeSingle()
    : { data: null }

  const presentation = documentPresentation(doc.type as DocumentType)

  // Podpis a peciatku dodavatela tlacime len tam, kde ich doklad unesie, tak
  // ich inde ani nestahujeme (viz showsSupplierMark).
  const wantsSupplierMark = showsSupplierMark(presentation)

  // QR generujeme len pre doklady, ktore su vyzvou na uhradu. Bez tejto
  // podmienky by sa PAY by square pocital aj pre dodaci list a cenovu ponuku —
  // PDF ho tam uz nevykresli, ale praca aj tak prebehne.
  const [qrDataUrl, logoDataUrl, signatureDataUrl, stampDataUrl] =
    await Promise.all([
      presentation.showQr && bank?.iban && doc.status !== "paid"
        ? paymentQrDataUrl({
            iban: bank.iban,
            amount: doc.total,
            currency: doc.currency,
            variableSymbol: doc.number?.replace(/\D/g, "") ?? null,
            note: doc.number ?? null,
            dueDate: doc.due_date,
            customerCountry: contact?.country ?? null,
            beneficiaryName: org.name,
          })
        : null,
      imageDataUrl(org.logo_url),
      wantsSupplierMark ? imageDataUrl(org.signature_url) : null,
      wantsSupplierMark ? imageDataUrl(org.stamp_url) : null,
    ])

  const buffer = await renderToBuffer(
    <InvoiceDocument
      document={doc}
      items={items ?? []}
      org={org}
      contact={contact}
      bank={bank}
      qrDataUrl={qrDataUrl}
      logoDataUrl={logoDataUrl}
      signatureDataUrl={signatureDataUrl}
      stampDataUrl={stampDataUrl}
    />,
  )

  return { buffer, doc, contact, org }
}
