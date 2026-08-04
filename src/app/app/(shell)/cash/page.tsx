import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { CashView } from "@/components/cash/cash-view"

export const metadata = { title: "Pokladňa — Synapse Faktúra" }

export default async function CashPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez aktivnej organizacie nemame co zobrazit — prazdny stav.
  if (!orgId) {
    return (
      <CashView
        registers={[]}
        items={[]}
        contacts={[]}
        documents={[]}
        expenses={[]}
      />
    )
  }

  const [
    { data: registers },
    { data: items },
    { data: contacts },
    { data: documents },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("cash_registers")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    // Doklady tahame vsetky — zostatok pokladne je ich sucet, takze `limit`
    // by ho ticho skreslil.
    supabase
      .from("cash_register_items")
      .select("*, contacts(name)")
      .eq("organization_id", orgId)
      .order("issued_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name"),
    supabase
      .from("documents")
      .select("id, number, total, currency")
      .eq("organization_id", orgId)
      .order("issue_date", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("expenses")
      .select("id, document_number, total, currency")
      .eq("organization_id", orgId)
      .order("issue_date", { ascending: false, nullsFirst: false })
      .limit(100),
  ])

  return (
    <CashView
      registers={registers ?? []}
      items={items ?? []}
      contacts={contacts ?? []}
      documents={documents ?? []}
      expenses={expenses ?? []}
    />
  )
}
