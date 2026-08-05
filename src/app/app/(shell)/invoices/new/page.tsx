import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { InvoiceEditor } from "@/components/invoice/invoice-editor"
import { NlInvoiceBar } from "@/components/invoice/nl-invoice-bar"
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/documents/labels"
import type { VatMode } from "@/lib/validation/org"

export const metadata = { title: "Nový doklad — Synapse Faktúra" }

/**
 * Typ z adresy.
 *
 * Bez neho vznikol KAZDY novy doklad ako faktura — aj ked pouzivatel prisiel
 * z „Dodacie listy" a klikol na „Novy doklad". Typ potom musel prepnut az
 * v samotnom doklade.
 *
 * `Object.hasOwn`, nie `in`: `in` prehlada aj prototyp, takze `?type=toString`
 * by presiel ako platny typ a dotaz by spadol na neplatnej hodnote enumu.
 */
function parseType(value: string | string[] | undefined): DocumentType | null {
  if (typeof value !== "string") return null
  return Object.hasOwn(DOCUMENT_TYPE_LABELS, value)
    ? (value as DocumentType)
    : null
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>
}) {
  const sp = await searchParams
  const initialType = parseType(sp.type)

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) notFound()

  // Kazdy dotaz je org-scoped. Samotna RLS pusti VSETKY organizacie, ktorych je
  // pouzivatel clenom, takze clen dvoch firiem by tu videl kontakty a cennik
  // oboch. `organizations` cez `limit(1)` by navyse vratilo lubovolnu firmu
  // a s nou cudzie predvolby rezimu DPH a splatnosti.
  const [{ data: contacts }, { data: products }, { data: org }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("*")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("products")
        .select("*")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("organizations")
        .select("vat_mode_default, default_due_days")
        .eq("id", orgId)
        .maybeSingle(),
    ])

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      {/* Diktovanie vetou vytvara FAKTURU, takze pri dodacom liste alebo
          cenovej ponuke by len mylilo. */}
      {initialType === null || initialType === "invoice" ? (
        <NlInvoiceBar />
      ) : null}
      <InvoiceEditor
        contacts={contacts ?? []}
        products={products ?? []}
        defaultVatMode={(org?.vat_mode_default as VatMode) ?? "payer"}
        defaultDueDays={org?.default_due_days ?? 14}
        initialType={initialType ?? undefined}
      />
    </div>
  )
}
