import "server-only"

import { renderToBuffer } from "@react-pdf/renderer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { InvoiceDocument, showsSupplierMark } from "@/lib/pdf/invoice-document"
import { paymentQrDataUrl } from "@/lib/qr/payment-qr"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkImage, MAX_IMAGE_BYTES } from "@/lib/images/validate"
import { ATTACHMENTS_BUCKET } from "@/lib/storage/buckets"
import { documentPresentation } from "@/lib/documents/presentation"
import { resolveClientDetails } from "@/lib/documents/client-details"
import type { DocumentType } from "@/lib/documents/labels"

type Db = SupabaseClient<Database>
type DocRow = Database["public"]["Tables"]["documents"]["Row"]
type Contact = Database["public"]["Tables"]["contacts"]["Row"]
type Org = Database["public"]["Tables"]["organizations"]["Row"]

export type RenderedInvoice = {
  buffer: Buffer
  doc: DocRow
  /**
   * ZIVY kontakt — sluzi na dorucenie (aktualny e-mail), nie na to, co je
   * vytlacene v PDF. Vytlacene udaje urcuje `resolveClientDetails`.
   */
  contact: Contact | null
  org: Org
}

/** Rozpocet na stiahnutie jedneho firemneho obrazka (logo/podpis/peciatka). */
const IMAGE_TIMEOUT_MS = 2500

/**
 * Vrati obrazok ako data URI. Prijme dve podoby:
 *
 *  - `https://…`  — verejna adresa (starsie zaznamy, cudzi hosting),
 *  - `{orgId}/branding/…` — cesta v SUKROMNOM buckete `attachments`.
 *
 * Sukromne ulozisko je zamer, nie komplikacia: verejna URL na obrazok PODPISU
 * je navod na falsovanie. Preto sa subor stahuje service-role klientom priamo
 * tu — tento modul je `server-only`, takze sa do prehliadaca nedostane.
 *
 * Stahujeme tu a nie v @react-pdf/renderer: renderer by siahal na siet bez
 * timeoutu az pocas layoutu, takze nedostupny bucket by drzal generovanie PDF
 * — a to iste PDF sa priklada k odosielanej fakture (markAsSent). Kazde
 * zlyhanie preto konci ako `null` a doklad sa vykresli bez obrazka.
 */
async function imageDataUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null
  try {
    let bytes: Buffer
    if (/^https?:\/\//i.test(pathOrUrl)) {
      const res = await fetch(pathOrUrl, {
        signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
        cache: "no-store",
      })
      if (!res.ok) return null
      const declared = Number(res.headers.get("content-length"))
      if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null
      bytes = Buffer.from(await res.arrayBuffer())
    } else {
      const { data, error } = await createAdminClient()
        .storage.from(ATTACHMENTS_BUCKET)
        .download(pathOrUrl)
      if (error || !data) return null
      bytes = Buffer.from(await data.arrayBuffer())
    }

    // Ta ISTA kontrola ako pri uploade (lib/images/validate) — co preslo
    // nahravanim, sa musi dat aj vykreslit.
    const check = checkImage(bytes)
    if (!check.ok) return null
    return `data:${check.mime};base64,${bytes.toString("base64")}`
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
  const docQuery = db.from("documents").select("*").eq("id", id)

  const [{ data: doc }, { data: items }, { data: org }, { data: bank }] =
    await Promise.all([
      // Doklad MUSI byt filtrovany na tu istu organizaciu ako hlavicka a banka.
      // Bez toho si clen dvoch firiem cez /app/invoices/<id-z-firmy-B>/pdf
      // vytiahol doklad firmy B vysadzany s hlavickou a IBAN-om firmy A —
      // vratane QR kodu, ktory vyzyva na uhradu cudzej sumy na vlastny ucet.
      // RLS to nezachyti: pusti vsetky organizacie, ktorych je pouzivatel clenom.
      (orgId ? docQuery.eq("organization_id", orgId) : docQuery).maybeSingle(),
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
    ? await db
        .from("contacts")
        .select("*")
        .eq("id", doc.contact_id)
        .maybeSingle()
    : { data: null }

  // Na doklad patria udaje odberatela k okamihu vystavenia. Zivy kontakt sa
  // pouzije len tam, kde snapshot nie je (koncepty a doklady spred migracie).
  const client = resolveClientDetails(doc.client_snapshot, contact)

  const presentation = documentPresentation(doc.type as DocumentType, {
    showPrices: doc.show_prices,
    showQr: doc.show_qr_payment,
    signatureArea: doc.show_signature,
  })

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
            customerCountry: client?.country ?? null,
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
      client={client}
      bank={bank}
      qrDataUrl={qrDataUrl}
      logoDataUrl={logoDataUrl}
      signatureDataUrl={signatureDataUrl}
      stampDataUrl={stampDataUrl}
    />,
  )

  return { buffer, doc, contact, org }
}
