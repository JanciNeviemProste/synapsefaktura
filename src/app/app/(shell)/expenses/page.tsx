import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { ExpensesView } from "@/components/expenses/expenses-view"

export const metadata = { title: "Náklady — Synapse Faktúra" }

export default async function ExpensesPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez organizacie nemame co zobrazit — vykreslime prazdny stav.
  if (!orgId) {
    return <ExpensesView expenses={[]} suppliers={[]} />
  }

  const [{ data: expenses }, { data: contacts }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, contacts(name)")
      .eq("organization_id", orgId)
      .order("issue_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("contacts")
      .select("id, name, type")
      .eq("organization_id", orgId)
      .in("type", ["supplier", "both"])
      .order("name"),
  ])

  return <ExpensesView expenses={expenses ?? []} suppliers={contacts ?? []} />
}
