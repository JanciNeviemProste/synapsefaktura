"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react"
import { Sparkles, Check } from "lucide-react"
import { toast } from "sonner"

import { startCheckout } from "@/app/actions/billing"
import { trackEvent } from "@/lib/analytics/track"
import { PLANS, type PlanTier } from "@/lib/billing/plans"
import { featureLabel } from "@/lib/billing/feature-labels"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type UpgradeState = { tier: PlanTier; reason?: string } | null

type UpgradeContextValue = {
  /** Open the paywall dialog for the given required tier. */
  prompt: (tier: PlanTier, reason?: string) => void
}

const UpgradeContext = createContext<UpgradeContextValue | null>(null)

/** Access the in-context paywall. Safe no-op when no provider is mounted. */
export function useUpgrade(): UpgradeContextValue {
  return (
    useContext(UpgradeContext) ?? {
      prompt: () => {},
    }
  )
}

export function UpgradeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UpgradeState>(null)
  const [pending, start] = useTransition()

  const prompt = useCallback((tier: PlanTier, reason?: string) => {
    // Free is never an upgrade target; clamp to the lowest paid tier.
    setState({ tier: tier === "free" ? "pro" : tier, reason })
  }, [])

  const value = useMemo(() => ({ prompt }), [prompt])

  const plan = state ? PLANS[state.tier] : null

  function checkout() {
    if (!state) return
    trackEvent("Upgrade Click", { tier: state.tier })
    start(async () => {
      const res = await startCheckout(state.tier as "pro" | "business")
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "Platbu sa nepodarilo spustiť.")
        return
      }
      window.location.href = res.url
    })
  }

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <Dialog open={state !== null} onOpenChange={(o) => !o && setState(null)}>
        {plan && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="text-primary size-5" />
                Odomkni plán {plan.label}
              </DialogTitle>
              <DialogDescription>
                {state?.reason ??
                  `Táto funkcia je dostupná v pláne ${plan.label}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{plan.priceEur} €</span>
                <span className="text-muted-foreground text-sm">/ mesiac</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  14 dní zdarma
                </span>
              </div>
              <ul className="grid gap-1.5 text-sm">
                {[...plan.features].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-4 text-green-600" />
                    {featureLabel(f)}
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setState(null)}
                disabled={pending}
              >
                Neskôr
              </Button>
              <Button onClick={checkout} disabled={pending}>
                Prejsť na {plan.label}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </UpgradeContext.Provider>
  )
}
