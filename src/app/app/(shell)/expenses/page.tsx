import { createClient } from "@/lib/supabase/server"
import { ExpensesView } from "@/components/expenses/expenses-view"

export const metadata = { title: "Náklady — Synapse Faktúra" }

export default async function ExpensesPage() {
  const supabase = await createClient()
  const [{ data: expenses }, { data: contacts }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, contacts(name)")
      .order("issue_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("contacts")
      .select("id, name, type")
      .in("type", ["supplier", "both"])
      .order("name"),
  ])

  return <ExpensesView expenses={expenses ?? []} suppliers={contacts ?? []} />
}
