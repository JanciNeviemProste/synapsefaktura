import Link from "next/link"
import { Sparkles, Check, Minus, Bot, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SiteFooter } from "@/components/site-footer"
import { PLANS, PLAN_ORDER, type Feature, type PlanTier } from "@/lib/billing/plans"
import { featureLabel } from "@/lib/billing/feature-labels"

const FEATURES = [
  {
    icon: Bot,
    title: "AI, ktorá za teba píše",
    text: "Vystav faktúru jednou vetou, doklady ti vyťaží AI a asistent odpovie na otázky o financiách.",
  },
  {
    icon: ShieldCheck,
    title: "Správnosť ako funkcia",
    text: "Kontrola DPH (23/19/5 %) a povinných náležitostí ešte pred vystavením dokladu.",
  },
  {
    icon: Zap,
    title: "Pripravené na e-faktúru 2027",
    text: "Postavené na Peppol / EN 16931 od základu. Migruj skôr, než príde povinnosť.",
  },
]

/** Highlighted bullet lines per plan for the pricing cards. */
const PLAN_HIGHLIGHTS: Record<PlanTier, string[]> = {
  free: ["5 dokladov / mesiac", "Príjem e-faktúr (Peppol)", "1 používateľ"],
  pro: [
    "Neobmedzené doklady",
    ...[...PLANS.pro.features].map(featureLabel),
  ],
  business: [
    "Všetko z Pro",
    ...[...PLANS.business.features]
      .filter((f) => !PLANS.pro.features.has(f))
      .map(featureLabel),
  ],
}

const ALL_FEATURES: Feature[] = [
  "aiCapture",
  "nlInvoice",
  "assistant",
  "smartReminders",
  "anomaly",
  "forecast",
  "multiUser",
  "peppolSend",
  "advancedReports",
  "api",
]

const FAQ = [
  {
    q: "Kedy začne platiť povinná e-faktúra?",
    a: "Od 1. 1. 2027 pre platiteľov DPH (novela zákona 222/2004 Z. z., model Peppol / IS EFA). Synapse Faktúra je na to postavená od základu.",
  },
  {
    q: "Musím hneď platiť?",
    a: "Nie. Plán Free je zadarmo navždy (5 dokladov/mesiac). Plán Pro si vyskúšaš 14 dní zdarma.",
  },
  {
    q: "Môžem predplatné kedykoľvek zrušiť?",
    a: "Áno, kedykoľvek — predplatné platí do konca zaplateného obdobia.",
  },
  {
    q: "Je to v súlade so slovenskou legislatívou?",
    a: "Áno — správne sadzby DPH (23/19/5 %), povinné náležitosti dokladov a Peppol / EN 16931 pre e-faktúru 2027.",
  },
  {
    q: "Podporujete češtinu?",
    a: "Áno, rozhranie aj doklady vieš mať v slovenčine, češtine aj angličtine.",
  },
]

function planPrice(tier: PlanTier): string {
  const p = PLANS[tier].priceEur
  return p ? `${p} €` : "0 €"
}

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <span className="flex items-center gap-2 font-semibold">
          <Sparkles className="text-primary size-5" />
          Synapse Faktúra
        </span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Prihlásiť sa</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Začať zadarmo</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
        <Link
          href="/e-faktura-2027"
          className="bg-muted/50 hover:bg-muted rounded-full border px-3 py-1 text-xs font-medium"
        >
          Pripravené na povinnú e-faktúru 2027 →
        </Link>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Fakturácia novej generácie
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Vystavíš faktúru jednou vetou, doklady ti vyťaží AI a si pripravený na
          povinnú e-faktúru 2027. Moderná slovenská fakturácia s AI.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">Začať zadarmo</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/e-faktura-2027">Čo je e-faktúra 2027?</Link>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Bez platobnej karty · Pro na 14 dní zdarma
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map((f) => {
          const Icon = f.icon
          return (
            <Card key={f.title}>
              <CardHeader>
                <Icon className="text-primary size-6" />
                <CardTitle className="text-lg">{f.title}</CardTitle>
                <CardDescription>{f.text}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </section>

      {/* Pricing */}
      <section id="cennik" className="mx-auto max-w-5xl px-6 pb-16">
        <h2 className="mb-2 text-center text-2xl font-semibold">
          Jednoduché ceny
        </h2>
        <p className="text-muted-foreground mb-10 text-center text-sm">
          Free navždy zadarmo. Pro na 14 dní zdarma, potom {planPrice("pro")} /
          mesiac. Zruš kedykoľvek.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {PLAN_ORDER.map((tier) => {
            const plan = PLANS[tier]
            const highlight = tier === "pro"
            return (
              <Card
                key={tier}
                className={highlight ? "border-primary shadow-md" : undefined}
              >
                <CardHeader>
                  <CardTitle className="flex items-baseline justify-between">
                    {plan.label}
                    {highlight && (
                      <span className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs">
                        Obľúbené
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      {planPrice(tier)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {plan.priceEur ? "/ mesiac" : "navždy"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <ul className="grid gap-2 text-sm">
                    {PLAN_HIGHLIGHTS[tier].map((feat) => (
                      <li key={feat} className="flex items-center gap-2">
                        <Check className="text-primary size-4 shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={highlight ? "default" : "outline"}
                    className="mt-2 w-full"
                  >
                    <Link href="/register">
                      {tier === "free" ? "Začať zadarmo" : `Vyskúšať ${plan.label}`}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 text-left font-medium">Funkcia</th>
                {PLAN_ORDER.map((t) => (
                  <th key={t} className="px-3 py-3 text-center font-medium">
                    {PLANS[t].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3">Doklady / mesiac</td>
                {PLAN_ORDER.map((t) => (
                  <td key={t} className="px-3 py-3 text-center">
                    {PLANS[t].docsPerMonth === null
                      ? "∞"
                      : PLANS[t].docsPerMonth}
                  </td>
                ))}
              </tr>
              {ALL_FEATURES.map((f) => (
                <tr key={f} className="border-b">
                  <td className="py-3">{featureLabel(f)}</td>
                  {PLAN_ORDER.map((t) => (
                    <td key={t} className="px-3 py-3 text-center">
                      {PLANS[t].features.has(f) ? (
                        <Check className="text-primary mx-auto size-4" />
                      ) : (
                        <Minus className="text-muted-foreground mx-auto size-4" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2027 section */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold">Povinná e-faktúra prichádza 2027</h2>
          <p className="text-muted-foreground">
            Od 1. 1. 2027 budú platitelia DPH musieť vystavovať e-faktúry cez
            Peppol / IS EFA. Priprav sa s predstihom — bez stresu na poslednú chvíľu.
          </p>
          <Button asChild variant="outline">
            <Link href="/e-faktura-2027">Zisti viac o e-faktúre 2027</Link>
          </Button>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="mb-8 text-center text-2xl font-semibold">
          Časté otázky
        </h2>
        <div className="grid gap-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="bg-card rounded-lg border px-4 py-3"
            >
              <summary className="cursor-pointer font-medium">{item.q}</summary>
              <p className="text-muted-foreground mt-2 text-sm">{item.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button asChild size="lg">
            <Link href="/register">Začať zadarmo</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
