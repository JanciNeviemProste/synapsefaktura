"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Inbox, RefreshCw, Receipt } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("einvoices")
  const [pollPending, startPoll] = useTransition()
  const [convertPending, startConvert] = useTransition()

  function handlePoll() {
    startPoll(async () => {
      const res = await pollMyInbox()
      if (!res.ok) {
        toast.error(res.error ?? t("checkFailed"))
        return
      }
      if (res.received > 0) {
        toast.success(t("received", { count: res.received }))
      } else {
        toast.info(t("noNew"))
      }
      router.refresh()
    })
  }

  function handleConvert(id: string) {
    startConvert(async () => {
      const res = await inboundToExpense(id)
      if (!res.ok) {
        toast.error(res.error ?? t("convertFailed"))
        return
      }
      toast.success(t("expenseCreated"))
      router.refresh()
    })
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[clamp(24px,3.2vw,34px)] leading-tight tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button onClick={handlePoll} disabled={pollPending}>
          <RefreshCw
            className={pollPending ? "size-4 animate-spin" : "size-4"}
          />
          {t("checkInbox")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("receivedTitle")}</CardTitle>
          <CardDescription>{t("receivedDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {initial.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                <Inbox className="text-muted-foreground size-6" />
              </div>
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colNumber")}</TableHead>
                  <TableHead>{t("colSupplier")}</TableHead>
                  <TableHead className="text-right">{t("colAmount")}</TableHead>
                  <TableHead>{t("colReceived")}</TableHead>
                  <TableHead className="w-40 text-right">
                    {t("colActions")}
                  </TableHead>
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
                        <Badge variant="secondary">{t("expenseCreated")}</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConvert(row.id)}
                          disabled={convertPending}
                        >
                          <Receipt className="size-4" />
                          {t("createExpense")}
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
