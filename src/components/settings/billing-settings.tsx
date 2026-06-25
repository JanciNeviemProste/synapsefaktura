"use client"

import { useTransition } from "react"
import { CreditCard, Sparkles, Check } from "lucide-react"
import { toast } from "sonner"

import {
  startCheckout,
  openPortal,
  type BillingInfo,
} from "@/app/actions/billing"
import { PLANS, type PlanTier } from "@/lib/billing/plans"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const FEATURE_LABELS: Record<string, string> = {
  aiCapture: "AI vyťaženie dokladov",
  nlInvoice: "Fakturácia vetou",
  assistant: "AI asistent",
  smartReminders: "Inteligentné upomienky",
  forecast: "Prognózy cash-flow",
  anomaly: "Detekcia anomálií",
  multiUser: "Viac používateľov",
  peppolSend: "Odosielanie e-faktúr (Peppol)",
  advancedReports: "Pokročilé reporty",
  api: "Prístup k API",
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}.${mm}.${d.getFullYear()}`
}

export function BillingSettings({ initial }: { initial: BillingInfo }) {
  const [pending, start] = useTransition()

  const currentPlan = PLANS[initial.plan]
  const limit = initial.docLimit
  const used = initial.issuedThisMonth
  const pct =
    limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  function upgrade(tier: "pro" | "business") {
    start(async () => {
      const res = await startCheckout(tier)
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "Platbu sa nepodarilo spustiť.")
        return
      }
      window.location.href = res.url
    })
  }

  function manage() {
    start(async () => {
      const res = await openPortal()
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "Portál sa nepodarilo otvoriť.")
        return
      }
      window.location.href = res.url
    })
  }

  const upgradeTiers: ("pro" | "business")[] = (
    ["pro", "business"] as const
  ).filter((t) => t !== initial.plan)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5" />
          Predplatné
        </CardTitle>
        <CardDescription>
          Spravujte svoj plán a sledujte mesačné využitie.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {/* Current plan */}
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">
                {currentPlan.label}
              </span>
              <span className="text-muted-foreground text-sm">
                {currentPlan.priceEur
                  ? `${currentPlan.priceEur} € / mesiac`
                  : "zadarmo"}
              </span>
            </div>
            {initial.subscriptionStatus ? (
              <p className="text-muted-foreground text-sm">
                Stav predplatného: {initial.subscriptionStatus}
                {initial.currentPeriodEnd
                  ? ` · obnovenie ${formatDate(initial.currentPeriodEnd)}`
                  : ""}
              </p>
            ) : null}
          </div>
          {initial.stripeConfigured && initial.plan !== "free" ? (
            <Button
              type="button"
              variant="outline"
              onClick={manage}
              disabled={pending}
            >
              Spravovať predplatné
            </Button>
          ) : null}
        </div>

        {/* Usage */}
        <div className="grid gap-2">
          <p className="text-sm">
            Vystavené doklady tento mesiac: {used} /{" "}
            {limit === null ? "neobmedzene" : limit}
          </p>
          {limit !== null ? (
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : null}
        </div>

        {!initial.stripeConfigured ? (
          <div className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm">
            Platby nie sú nakonfigurované (Stripe kľúče doplníte neskôr).
          </div>
        ) : null}

        {/* Upgrade cards */}
        {upgradeTiers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {upgradeTiers.map((tier) => {
              const plan = PLANS[tier as PlanTier]
              return (
                <div
                  key={tier}
                  className="flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-primary size-4" />
                    <span className="font-semibold">{plan.label}</span>
                    <span className="text-muted-foreground ml-auto text-sm">
                      {plan.priceEur} € / mesiac
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{plan.blurb}</p>
                  <ul className="grid gap-1.5 text-sm">
                    {[...plan.features].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="size-4 text-green-600" />
                        {FEATURE_LABELS[f] ?? f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    className="mt-auto"
                    onClick={() => upgrade(tier)}
                    disabled={pending || !initial.stripeConfigured}
                  >
                    Prejsť na {plan.label}
                  </Button>
                </div>
              )
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
