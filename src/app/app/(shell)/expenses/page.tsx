import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { listTags, taggedEntityIds, entityTagMap } from "@/app/actions/tags"
import {
  expenseItemsByExpense,
  expensePaymentsByExpense,
} from "@/app/actions/expenses"
import { ExpensesView } from "@/components/expenses/expenses-view"

export const metadata = { title: "Náklady — Synapse Faktúra" }

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string | string[] }>
}) {
  const sp = await searchParams
  const activeTagId = typeof sp.tag === "string" ? sp.tag : null

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez organizacie nemame co zobrazit — vykreslime prazdny stav.
  if (!orgId) {
    return <ExpensesView expenses={[]} suppliers={[]} />
  }

  const [tags, taggedIds] = await Promise.all([
    listTags(),
    taggedEntityIds("expense", activeTagId ?? undefined),
  ])

  // `taggedIds === null` znamena "bez filtra", `[]` znamena "nic nevyhovuje".
  let expensesQuery = supabase
    .from("expenses")
    .select("*, contacts(name)")
    .eq("organization_id", orgId)
  if (taggedIds) expensesQuery = expensesQuery.in("id", taggedIds)

  const [{ data: expenses }, { data: contacts }] = await Promise.all([
    expensesQuery.order("issue_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("contacts")
      .select("id, name, type")
      .eq("organization_id", orgId)
      .in("type", ["supplier", "both"])
      .order("name"),
  ])

  const rows = expenses ?? []
  const ids = rows.map((e) => e.id)
  const [tagsByExpense, itemsByExpense, paymentsByExpense] = await Promise.all([
    entityTagMap("expense", ids),
    expenseItemsByExpense(ids),
    expensePaymentsByExpense(ids),
  ])

  return (
    <ExpensesView
      expenses={rows}
      suppliers={contacts ?? []}
      tags={tags}
      tagsByExpense={tagsByExpense}
      itemsByExpense={itemsByExpense}
      paymentsByExpense={paymentsByExpense}
      activeTagId={activeTagId}
    />
  )
}
