"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Inbox, RefreshCw, Receipt } from "lucide-react"
import { toast } from "sonner"

import { formatMoney } from "@/lib/money"
import {
  listInbound,
  pollMyInbox,
  inboundToExpense,
} from "@/app/actions/einvoice-inbound"

import { Button } from "@/components/ui/button"
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

type InboundItem = Awaited<ReturnType<typeof listInbound>>[number]

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("sk-SK")
}

export function InboxView({ initial }: { initial: InboundItem[] }) {
  const router = useRouter()
  const [pollPending, startPoll] = useTransition()
  const [convertPending, startConvert] = useTransition()

  function handlePoll() {
    startPoll(async () => {
      const res = await pollMyInbox()
      if (!res.ok) {
        toast.error(res.error ?? "Nepodarilo sa skontrolovať schránku.")
        return
      }
      if (res.received > 0) {
        toast.success(`Prijaté nové e-faktúry: ${res.received}`)
      } else {
        toast.info("Žiadne nové e-faktúry.")
      }
      router.refresh()
    })
  }

  function handleConvert(id: string) {
    startConvert(async () => {
      const res = await inboundToExpense(id)
      if (!res.ok) {
        toast.error(res.error ?? "Nepodarilo sa vytvoriť náklad.")
        return
      }
      toast.success("Náklad vytvorený.")
      router.refresh()
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prijaté e-faktúry</h1>
          <p className="text-muted-foreground text-sm">
            Elektronické faktúry doručené cez sieť Peppol.
          </p>
        </div>
        <Button onClick={handlePoll} disabled={pollPending}>
          <RefreshCw
            className={pollPending ? "size-4 animate-spin" : "size-4"}
          />
          Skontrolovať schránku
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Doručené dokumenty</CardTitle>
          <CardDescription>
            Z prijatej e-faktúry vytvoríte náklad jedným klikom.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initial.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                <Inbox className="text-muted-foreground size-6" />
              </div>
              <p className="text-muted-foreground text-sm">
                Zatiaľ žiadne prijaté e-faktúry.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Číslo</TableHead>
                  <TableHead>Dodávateľ</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                  <TableHead>Prijaté</TableHead>
                  <TableHead className="w-40 text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.summary?.number ?? "—"}
                    </TableCell>
                    <TableCell>{row.summary?.supplierName ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.summary
                        ? formatMoney(row.summary.total, row.summary.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>{fmtDate(row.created_at)}</TableCell>
                    <TableCell className="text-right">
                      {row.hasExpense ? (
                        <Badge variant="secondary">Náklad vytvorený</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvert(row.id)}
                          disabled={convertPending}
                        >
                          <Receipt className="size-4" />
                          Vytvoriť náklad
                        </Button>
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
