"use client"

import { useEffect, useState, useTransition } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { LogbookFinding } from "@/lib/logbook/audit"
import { auditVehicleLogbook } from "@/app/actions/logbook-summary"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const severityLabel: Record<LogbookFinding["severity"], string> = {
  error: "Chyba",
  warning: "Varovanie",
  info: "Info",
}

const severityBadge: Record<
  LogbookFinding["severity"],
  "destructive" | "secondary" | "outline"
> = {
  error: "destructive",
  warning: "secondary",
  info: "outline",
}

/** Farba pruhu aj ikony — cervena = zastavit sa, jantarova = pozriet, seda = na vedomie. */
const severityAccent: Record<LogbookFinding["severity"], string> = {
  error: "border-l-destructive text-destructive",
  warning: "border-l-amber-500 text-amber-600 dark:text-amber-500",
  info: "border-l-border text-muted-foreground",
}

function SeverityIcon({ severity }: { severity: LogbookFinding["severity"] }) {
  const cls = "size-4 shrink-0"
  switch (severity) {
    case "error":
      return <AlertCircle className={cls} />
    case "warning":
      return <AlertTriangle className={cls} />
    case "info":
      return <Info className={cls} />
  }
}

/** Slovencina ma tri tvary: 1 chyba, 2-4 chyby, inak chyb. */
function pluralSk(count: number, forms: [string, string, string]): string {
  if (count === 1) return forms[0]
  if (count >= 2 && count <= 4) return forms[1]
  return forms[2]
}

/** ISO datum na slovensky zapis; bez `Date`, aby do toho nevstupila zona. */
function formatDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])}.${Number(m[2])}.${m[1]}`
}

/**
 * Samotny zoznam nalezov. Vydeleny, aby sa dal vykreslit aj zo Server
 * Component, ktory si nalezy nacita sam.
 */
export function LogbookFindingList({
  findings,
}: {
  findings: LogbookFinding[]
}) {
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-500" />
        <p className="font-medium">Kniha jázd sedí.</p>
        <p className="text-muted-foreground text-sm">
          Nenašli sme žiadne nezrovnalosti — vykázané kilometre zodpovedajú
          natankovanému palivu a stav tachometra na seba nadväzuje.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {findings.map((f, i) => (
        <li
          key={`${f.code}-${i}`}
          className={cn(
            "bg-muted/30 flex items-start gap-3 rounded-md border-l-2 py-2 pr-3 pl-3",
            severityAccent[f.severity],
          )}
        >
          <SeverityIcon severity={f.severity} />
          <p className="text-foreground flex-1 text-sm leading-snug">
            {f.message}
          </p>
          <Badge variant={severityBadge[f.severity]}>
            {severityLabel[f.severity]}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/**
 * Kontrola knihy jazd pred danovou kontrolou.
 *
 * Preco to niekomu zalezi: kniha jazd je danovy podklad. Pri kontrole sa
 * porovnava najazdene km x normovana spotreba oproti realne nakupenemu palivu
 * a uznat sa da len to nizsie z dvojice. Tento panel spocita to iste dopredu.
 */
export function LogbookSummary({
  vehicleId,
  periodFrom,
  periodTo,
}: {
  vehicleId: string
  periodFrom: string
  periodTo: string
}) {
  const [findings, setFindings] = useState<LogbookFinding[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const result = await auditVehicleLogbook({
        vehicleId,
        periodFrom,
        periodTo,
      })
      if (!result.ok) {
        setError(result.error)
        setFindings([])
        return
      }
      setError(null)
      setFindings(result.findings)
    })
  }

  useEffect(() => {
    refresh()
    // Nalezy sa pretahuju vzdy, ked sa zmeni vozidlo alebo obdobie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, periodFrom, periodTo])

  const errors = findings?.filter((f) => f.severity === "error").length ?? 0
  const warnings = findings?.filter((f) => f.severity === "warning").length ?? 0

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          Kontrola pred daňovou kontrolou
        </CardTitle>
        <CardDescription>
          Za obdobie {formatDay(periodFrom)} – {formatDay(periodTo)}.
          {errors > 0 || warnings > 0
            ? ` Nájdené: ${errors} ${pluralSk(errors, ["chyba", "chyby", "chýb"])}, ` +
              `${warnings} ${pluralSk(warnings, ["varovanie", "varovania", "varovaní"])}.`
            : " Porovnávame vykázané kilometre s natankovaným palivom."}
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
        {findings === null || pending ? (
          <p className="text-muted-foreground text-sm">Načítavam…</p>
        ) : error ? (
          <p className="text-muted-foreground text-sm">{error}</p>
        ) : (
          <LogbookFindingList findings={findings} />
        )}
      </CardContent>
    </Card>
  )
}
