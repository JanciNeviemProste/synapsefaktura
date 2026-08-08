import "server-only"

import { renderToBuffer } from "@react-pdf/renderer"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { InvoiceDocument, showsSupplierMark } from "@/lib/pdf/invoice-document"
import { paymentQrDataUrl } from "@/lib/qr/payment-qr"
import { imageDataUrl } from "@/lib/pdf/image-data-url"
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

/**
 * Fetches a document with everything the invoice PDF needs and renders it to a
 * Buffer. Shared by the PDF download route and email delivery so the layout and
 * data-fetching stay in one place. Returns null when the document/org is missing.
 * Respects RLS via the passed client (use the user client for org-scoped access).
 *
 * `orgId` je POVINNE. Bol nepovinny a to bola diera: `renderInvoicePdf(db, id)`
 * bez neho vypol VSETKY org filtre naraz, takze `limit(1)` na organizacii
 * vratil lubovolnu firmu. Pri service-role klientovi (cron) to RLS nekryje
 * nicim. Volajuci, ktory organizaciu nepozna, PDF vykreslit nesmie — nech
 * skonci chybou, nie cudzou hlavickou.
 */
export async function renderInvoicePdf(
  db: Db,
  id: string,
  orgId: string,
): Promise<RenderedInvoice | null> {
  const [{ data: doc }, { data: items }, { data: org }, { data: bank }] =
    await Promise.all([
      // Doklad MUSI byt filtrovany na tu istu organizaciu ako hlavicka a banka.
      // Bez toho si clen dvoch firiem cez /app/invoices/<id-z-firmy-B>/pdf
      // vytiahol doklad firmy B vysadzany s hlavickou a IBAN-om firmy A —
      // vratane QR kodu, ktory vyzyva na uhradu cudzej sumy na vlastny ucet.
      // RLS to nezachyti: pusti vsetky organizacie, ktorych je pouzivatel clenom.
      db
        .from("documents")
        .select("*")
        .eq("id", id)
        .eq("organization_id", orgId)
        .maybeSingle(),
      db
        .from("document_items")
        .select("*")
        .eq("document_id", id)
        .order("position"),
      db.from("organizations").select("*").eq("id", orgId).maybeSingle(),
      db
        .from("bank_accounts")
        .select("*")
        .eq("organization_id", orgId)
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
      imageDataUrl(org.logo_url, orgId),
      wantsSupplierMark ? imageDataUrl(org.signature_url, orgId) : null,
      wantsSupplierMark ? imageDataUrl(org.stamp_url, orgId) : null,
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
