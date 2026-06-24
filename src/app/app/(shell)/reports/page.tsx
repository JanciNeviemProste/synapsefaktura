import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { formatMoney } from "@/lib/money"
import { computeSummary } from "@/lib/reports/summary"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = { title: "Reporty — Synapse Faktúra" }

const EXPORTS = [
  { type: "accounting-csv", label: "Účtovný export (CSV)" },
  { type: "accounting-xml", label: "Účtovný export (XML)" },
  { type: "kontrolny-vykaz", label: "Kontrolný výkaz DPH (XML)" },
  { type: "suhrnny-vykaz", label: "Súhrnný výkaz (XML)" },
  { type: "gdpr", label: "Export všetkých údajov (GDPR)" },
]

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const now = new Date()
  const from = sp.from ?? `${now.getFullYear()}-01-01`
  const to = sp.to ?? now.toISOString().slice(0, 10)
  const qs = `from=${from}&to=${to}`

  const supabase = await createClient()
  const [{ data: docs }, { data: expenses }] = await Promise.all([
    supabase
      .from("documents")
      .select("status, subtotal, vat_total, total, paid_amount")
      .eq("type", "invoice")
      .gte("issue_date", from)
      .lte("issue_date", to),
    supabase
      .from("expenses")
      .select("subtotal, vat_total, total, paid_amount, tax_deductible")
      .gte("issue_date", from)
      .lte("issue_date", to),
  ])

  const summary = computeSummary(docs ?? [], expenses ?? [])

  const cards = [
    { label: "Príjmy (základ)", value: summary.incomeBase },
    { label: "Náklady (základ)", value: summary.expenseBase },
    { label: "Zisk", value: summary.profit },
    { label: "DPH na odvod", value: summary.vatLiability },
    { label: "Príjem (uhradené)", value: summary.cashIn },
    { label: "Výdaj (uhradené)", value: summary.cashOut },
    { label: "Cashflow", value: summary.cashFlow },
    { label: "Obrat (s DPH)", value: summary.incomeTotal },
  ]

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reporty</h1>
        <p className="text-muted-foreground text-sm">
          Obdobie {from} – {to}.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Od</span>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Do</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          />
        </label>
        <Button type="submit" variant="outline" size="sm">
          Použiť obdobie
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatMoney(c.value)}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exporty pre účtovníka</CardTitle>
          <CardDescription>
            Výkazy DPH sú postavené na zdokumentovanej štruktúre FS SR — pred
            odoslaním na FS SR over schému (TODO verify).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {EXPORTS.map((e) => (
            <Button
              key={e.type}
              asChild
              variant="outline"
              className="justify-start"
            >
              <a href={`/app/reports/export/${e.type}?${qs}`}>
                <Download className="size-4" />
                {e.label}
              </a>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
