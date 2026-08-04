import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { renderInvoicePdf } from "@/lib/pdf/render"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // Organizaciu posielame aj pri pouzivatelskom klientovi: RLS pusti VSETKY
  // organizacie, ktorych je pouzivatel clenom, takze `limit(1)` nad
  // organizations/bank_accounts by clenovi dvoch firiem vedel dat do PDF cudziu
  // hlavicku a cudzi IBAN.
  const orgId = await getCurrentOrgId(supabase)
  // Bez znamej organizacie sa PDF nevykresluje. `orgId ?? undefined` by
  // `renderInvoicePdf` vratilo k spravaniu bez filtra — teda presne k tomu,
  // pred cim komentar vyssie varuje.
  if (!orgId) {
    return new Response("Chýba firma.", { status: 404 })
  }

  const rendered = await renderInvoicePdf(supabase, id, orgId)
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
