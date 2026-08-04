"use client"

import { useEffect, useState, useTransition } from "react"
import {
  AlertTriangle,
  Copy,
  FileWarning,
  Receipt,
  RefreshCw,
  TrendingUp,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { listAnomalies } from "@/app/actions/ai-anomaly"
import { useUpgrade } from "@/components/billing/upgrade-dialog"
import type { PlanTier } from "@/lib/billing/plans"
import type { Anomaly } from "@/lib/anomaly/detect"

const severityVariant: Record<
  Anomaly["severity"],
  "destructive" | "secondary" | "outline"
> = {
  danger: "destructive",
  warning: "secondary",
  info: "outline",
}

const severityLabel: Record<Anomaly["severity"], string> = {
  danger: "Vysoká",
  warning: "Stredná",
  info: "Nízka",
}

function KindIcon({ kind }: { kind: Anomaly["kind"] }) {
  const cls = "size-4 shrink-0 text-muted-foreground"
  switch (kind) {
    case "duplicate":
      return <Copy className={cls} />
    case "outlier":
      return <TrendingUp className={cls} />
    case "vat":
      return <Receipt className={cls} />
    case "missing":
      return <FileWarning className={cls} />
  }
}

/** Zamietnutie z gate-u: dovod + tier, ktory funkciu odomkne (ak je znamy). */
type Denied = { reason: string; upgrade?: PlanTier }

export function AnomalyWidget() {
  const [anomalies, setAnomalies] = useState<Anomaly[] | null>(null)
  const [denied, setDenied] = useState<Denied | null>(null)
  const [pending, startTransition] = useTransition()
  const { prompt } = useUpgrade()

  function refresh() {
    startTransition(async () => {
      const result = await listAnomalies()
      if (!result.ok) {
        setDenied({ reason: result.error, upgrade: result.upgrade })
        setAnomalies([])
        return
      }
      setDenied(null)
      setAnomalies(result.anomalies)
    })
  }

  useEffect(() => {
    refresh()
  }, [])

  const loading = anomalies === null || pending
  const isEmpty = anomalies !== null && anomalies.length === 0

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          Veci na pozretie
        </CardTitle>
        <CardDescription>
          Možné duplicity, nezvyčajné sumy a chýbajúce údaje.
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            disabled={pending}
            aria-label="Obnoviť"
          >
            <RefreshCw className={pending ? "animate-spin" : undefined} />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Načítavam…</p>
        ) : denied ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <p className="text-muted-foreground text-sm">{denied.reason}</p>
            {denied.upgrade && (
              <Button
                size="sm"
                onClick={() => prompt(denied.upgrade!, denied.reason)}
              >
                Odomknúť
              </Button>
            )}
          </div>
        ) : isEmpty ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Všetko vyzerá v poriadku.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {anomalies!.map((a) => (
              <li
                key={`${a.kind}-${a.entity}-${a.entityId}`}
                className="flex items-start gap-3"
              >
                <KindIcon kind={a.kind} />
                <p className="flex-1 text-sm leading-snug">{a.message}</p>
                <Badge variant={severityVariant[a.severity]}>
                  {severityLabel[a.severity]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
