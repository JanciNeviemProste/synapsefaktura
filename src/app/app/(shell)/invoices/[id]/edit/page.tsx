import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
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

  const [
    { data: doc },
    { data: items },
    { data: contacts },
    { data: products },
    { data: org },
  ] = await Promise.all([
    supabase.from("documents").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("document_items")
      .select("*")
      .eq("document_id", id)
      .order("position"),
    supabase.from("contacts").select("*").order("name"),
    supabase.from("products").select("*").order("name"),
    supabase
      .from("organizations")
      .select("vat_mode_default, default_due_days")
      .limit(1)
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
