import Link from "next/link"
import { FileText, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { round2, formatMoney } from "@/lib/money"
import { Button } from "@/components/ui/button"
import { ForecastWidget } from "@/components/dashboard/forecast-widget"
import { AnomalyWidget } from "@/components/dashboard/anomaly-widget"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = { title: "Prehľad — Synapse Faktúra" }

const OPEN_STATUSES = ["issued", "sent", "partially_paid", "overdue"]
const SK_MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "máj",
  "jún",
  "júl",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`

  const { data: docs } = await supabase
    .from("documents")
    .select("type, status, total, paid_amount, issue_date, due_date")
    .eq("type", "invoice")

  const invoices = docs ?? []

  const revenueThisMonth = round2(
    invoices
      .filter(
        (d) =>
          d.issue_date && d.issue_date >= monthStart && d.status !== "draft",
      )
      .reduce((s, d) => s + d.total, 0),
  )
  const open = invoices.filter((d) => OPEN_STATUSES.includes(d.status))
  const receivables = round2(
    open.reduce((s, d) => s + (d.total - d.paid_amount), 0),
  )
  const overdue = round2(
    open
      .filter((d) => d.due_date && d.due_date < todayIso)
      .reduce((s, d) => s + (d.total - d.paid_amount), 0),
  )
  const paidThisMonth = round2(
    invoices
      .filter((d) => d.issue_date && d.issue_date >= monthStart)
      .reduce((s, d) => s + d.paid_amount, 0),
  )

  // Last 6 months of revenue (issued invoices) for a lightweight bar chart.
  const months: { label: string; value: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const value = round2(
      invoices
        .filter((x) => x.issue_date?.startsWith(prefix) && x.status !== "draft")
        .reduce((s, x) => s + x.total, 0),
    )
    months.push({ label: SK_MONTHS_SHORT[d.getMonth()], value })
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.value))

  const stats = [
    { label: "Tržby tento mesiac", value: formatMoney(revenueThisMonth) },
    { label: "Pohľadávky", value: formatMoney(receivables) },
    { label: "Po splatnosti", value: formatMoney(overdue) },
    { label: "Uhradené tento mesiac", value: formatMoney(paidThisMonth) },
  ]

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prehľad</h1>
          <p className="text-muted-foreground text-sm">
            Stav tvojich financií v reálnom čase.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/invoices/new">
            <Plus className="size-4" />
            Nová faktúra
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tržby za posledných 6 mesiacov
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                <FileText className="text-muted-foreground size-6" />
              </div>
              <p className="text-muted-foreground text-sm">
                Zatiaľ žiadne faktúry. Vystav prvú faktúru.
              </p>
            </div>
          ) : (
            <div className="flex h-48 items-end gap-3">
              {months.map((m) => (
                <div
                  key={m.label}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="bg-primary/80 w-full rounded-t"
                      style={{ height: `${(m.value / maxMonth) * 100}%` }}
                      title={formatMoney(m.value)}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ForecastWidget />
        <AnomalyWidget />
      </div>
    </div>
  )
}
