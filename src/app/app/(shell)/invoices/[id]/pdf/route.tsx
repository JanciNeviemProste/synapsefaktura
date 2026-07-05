import { createClient } from "@/lib/supabase/server"
import { renderInvoicePdf } from "@/lib/pdf/render"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const rendered = await renderInvoicePdf(supabase, id)
  if (!rendered) {
    return new Response("Doklad sa nenašiel.", { status: 404 })
  }

  const { buffer, doc } = rendered
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${doc.number ?? "doklad"}.pdf"`,
    },
  })
}
