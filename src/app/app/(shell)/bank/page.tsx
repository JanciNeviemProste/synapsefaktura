import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { BankImport } from "@/components/bank/bank-import"

export const metadata = { title: "Banka — Synapse Faktúra" }

export default async function BankPage() {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)

  // Bez organizacie nie je co zobrazit - vykreslime prazdny stav
  const { data: transactions } = orgId
    ? await supabase
        .from("bank_transactions")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: null }

  return <BankImport transactions={transactions ?? []} />
}
