"use client"

import { useState, useTransition } from "react"
import { TrendingUp, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { formatMoney } from "@/lib/money"
import {
  generateForecast,
  type GenerateForecastResult,
} from "@/app/actions/ai-forecast"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ForecastWidget() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<GenerateForecastResult | null>(null)

  function run() {
    startTransition(async () => {
      const res = await generateForecast(90)
      if (!res.ok) {
        toast.error(res.error ?? "Prognózu sa nepodarilo vytvoriť.")
        return
      }
      setResult(res)
      toast.success(
        res.degraded
          ? "Prognóza vytvorená (bez AI)."
          : "Prognóza cashflow vytvorená.",
      )
    })
  }

  const buckets = result?.data?.buckets

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4" />
          Prognóza cashflow
        </CardTitle>
        <CardDescription>
          Očakávaný príjem na 30 / 60 / 90 dní a mesačný prehľad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={run} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Počítam…
            </>
          ) : (
            <>
              <TrendingUp className="size-4" />
              Vytvoriť prognózu
            </>
          )}
        </Button>

        {buckets && (
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["30 dní", buckets.day30],
                ["60 dní", buckets.day60],
                ["90 dní", buckets.day90],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="bg-muted/50 rounded-lg p-3">
                <div className="text-muted-foreground text-xs">{label}</div>
                <div className="font-heading text-base font-medium">
                  {formatMoney(value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {result?.narrative && (
          <div className="space-y-1">
            <div className="text-sm font-medium">Mesačný prehľad</div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {result.narrative}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
