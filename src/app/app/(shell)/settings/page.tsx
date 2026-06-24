import { createClient } from "@/lib/supabase/server"
import { SequencesSettings } from "@/components/settings/sequences-settings"
import { EInvoiceSettings } from "@/components/settings/einvoice-settings"
import { getEInvoiceSettings } from "@/app/actions/einvoice-settings"

export const metadata = { title: "Nastavenia — Synapse Faktúra" }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: sequences } = await supabase
    .from("number_sequences")
    .select("*")
    .order("year", { ascending: false })
    .order("doc_type")

  const einvoice = await getEInvoiceSettings()

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nastavenia</h1>
        <p className="text-muted-foreground text-sm">
          Číselné rady a predvoľby dokladov.
        </p>
      </div>
      <SequencesSettings sequences={sequences ?? []} />
      {einvoice ? <EInvoiceSettings initial={einvoice} /> : null}
    </div>
  )
}
