import { renderToBuffer } from "@react-pdf/renderer"
import { createClient } from "@/lib/supabase/server"
import { InvoiceDocument } from "@/lib/pdf/invoice-document"
import { paymentQrDataUrl } from "@/lib/qr/payment-qr"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: doc }, { data: items }, { data: org }, { data: bank }] =
    await Promise.all([
      supabase.from("documents").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("document_items")
        .select("*")
        .eq("document_id", id)
        .order("position"),
      supabase.from("organizations").select("*").limit(1).maybeSingle(),
      supabase
        .from("bank_accounts")
        .select("*")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (!doc || !org) {
    return new Response("Doklad sa nenašiel.", { status: 404 })
  }

  const { data: contact } = doc.contact_id
    ? await supabase
        .from("contacts")
        .select("*")
        .eq("id", doc.contact_id)
        .maybeSingle()
    : { data: null }

  const qrDataUrl =
    bank?.iban && doc.status !== "paid"
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

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${doc.number ?? "doklad"}.pdf"`,
    },
  })
}
