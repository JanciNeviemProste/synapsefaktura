import { createClient } from "@/lib/supabase/server"
import { InvoiceEditor } from "@/components/invoice/invoice-editor"
import { NlInvoiceBar } from "@/components/invoice/nl-invoice-bar"
import type { VatMode } from "@/lib/validation/org"

export const metadata = { title: "Nový doklad — Synapse Faktúra" }

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const [{ data: contacts }, { data: products }, { data: org }] =
    await Promise.all([
      supabase.from("contacts").select("*").order("name"),
      supabase.from("products").select("*").order("name"),
      supabase
        .from("organizations")
        .select("vat_mode_default, default_due_days")
        .limit(1)
        .maybeSingle(),
    ])

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <NlInvoiceBar />
      <InvoiceEditor
        contacts={contacts ?? []}
        products={products ?? []}
        defaultVatMode={(org?.vat_mode_default as VatMode) ?? "payer"}
        defaultDueDays={org?.default_due_days ?? 14}
      />
    </div>
  )
}
