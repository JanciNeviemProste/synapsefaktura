import { createClient } from "@/lib/supabase/server"
import { BankImport } from "@/components/bank/bank-import"

export const metadata = { title: "Banka — Synapse Faktúra" }

export default async function BankPage() {
  const supabase = await createClient()
  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  return <BankImport transactions={transactions ?? []} />
}
