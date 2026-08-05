import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { InvoiceEditor } from "@/components/invoice/invoice-editor"
import type { VatMode } from "@/lib/validation/org"

export const metadata = { title: "Upraviť doklad — Synapse Faktúra" }

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) notFound()

  // Kazdy dotaz je org-scoped. Samotna RLS nestaci — pusti VSETKY organizacie,
  // ktorych je pouzivatel clenom, takze clen dvoch firiem si cez podvrhnute id
  // otvoril na UPRAVU doklad tej druhej. `organizations` sa z rovnakeho dovodu
  // neberie cez `limit(1)`: vratilo by lubovolnu firmu a s nou cudzie
  // predvolby rezimu DPH a splatnosti.
  const [
    { data: doc },
    { data: items },
    { data: contacts },
    { data: products },
    { data: org },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabase
      .from("document_items")
      .select("*")
      .eq("document_id", id)
      .order("position"),
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

  if (!doc) notFound()

  return (
    <InvoiceEditor
      contacts={contacts ?? []}
      products={products ?? []}
      defaultVatMode={(org?.vat_mode_default as VatMode) ?? "payer"}
      defaultDueDays={org?.default_due_days ?? 14}
      document={doc}
      items={items ?? []}
    />
  )
}
