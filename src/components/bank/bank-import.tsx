"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { MAX_IMPORT_BYTES, tooLargeMessage } from "@/lib/upload/limits"

import type { Database } from "@/lib/supabase/database.types"
import { formatMoney } from "@/lib/money"
import { importBankCsv } from "@/app/actions/payments"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Tx = Database["public"]["Tables"]["bank_transactions"]["Row"]

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}

export function BankImport({ transactions }: { transactions: Tx[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Rocny vypis vie mat niekolko MB. Bez kontroly by skoncil na HTTP 413
    // bez hlasky — obsah ide na server ako telo server action.
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error(tooLargeMessage(file.size, MAX_IMPORT_BYTES))
      e.target.value = ""
      return
    }

    startTransition(async () => {
      try {
      const content = await file.text()
      const res = await importBankCsv(content)
      if (!res.ok) {
        toast.error(res.errors[0] ?? "Import zlyhal.")
        return
      }
      toast.success(
        `Importovaných ${res.imported}, spárovaných ${res.matched}, nespárovaných ${res.unmatched}.`,
      )
      if (res.errors.length)
        toast.warning(`${res.errors.length} riadkov preskočených.`)
      router.refresh()
      } catch {
        toast.error("Výpis sa nepodarilo načítať. Skús to znova.")
      }
    })
    e.target.value = ""
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Banka</h1>
        <p className="text-muted-foreground text-sm">
          Import bankového výpisu (CSV) a automatické párovanie platieb.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import výpisu</CardTitle>
          <CardDescription>
            Nahraj CSV z internetbankingu. Platby sa spárujú podľa variabilného
            symbolu (= číslo faktúry) a sumy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="bg-muted/30 hover:bg-muted/50 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm">
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Upload className="size-5" />
            )}
            {pending ? "Importujem…" : "Vyber CSV súbor"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
              disabled={pending}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pohyby na účte</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Zatiaľ žiadne importované pohyby.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Protistrana</TableHead>
                  <TableHead>VS</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{fmtDate(t.booked_at)}</TableCell>
                    <TableCell>{t.counterparty ?? "—"}</TableCell>
                    <TableCell>{t.vs ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(t.amount, t.currency)}
                    </TableCell>
                    <TableCell>
                      {t.matched_status === "matched" ? (
                        <Badge>
                          <CheckCircle2 className="size-3" /> Spárované
                        </Badge>
                      ) : (
                        <Badge variant="outline">Nespárované</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
