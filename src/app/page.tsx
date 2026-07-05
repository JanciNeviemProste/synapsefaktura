import Link from "next/link"
import { Sparkles, Check, Bot, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const FEATURES = [
  {
    icon: Bot,
    title: "AI, ktorá za teba píše",
    text: "Vystav faktúru jednou vetou, doklady ti vyťaží AI a asistent ti odpovie na otázky o financiách.",
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

const PLANS = [
  {
    name: "Free",
    price: "0 €",
    note: "navždy",
    features: [
      "Základná fakturácia",
      "Príjem e-faktúr (Peppol)",
      "1 používateľ",
    ],
    cta: "Začať zadarmo",
    highlight: false,
  },
  {
    name: "Pro",
    price: "~9–12 €",
    note: "/ mesiac",
    features: [
      "Neobmedzené doklady",
      "AI vyťaženie + faktúra vetou",
      "Asistent a smart upomienky",
    ],
    cta: "Vyskúšať Pro",
    highlight: true,
  },
  {
    name: "Business",
    price: "~19–29 €",
    note: "/ mesiac",
    features: [
      "Prognóza cashflow",
      "Odosielanie e-faktúr (Peppol)",
      "Viac používateľov a API",
    ],
    cta: "Vyskúšať Business",
    highlight: false,
  },
]

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Header */}
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
        <span className="bg-muted/50 rounded-full border px-3 py-1 text-xs font-medium">
          Pripravené na povinnú e-faktúru 2027
        </span>
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
            <Link href="/login">Mám už účet</Link>
          </Button>
        </div>
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
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-2 text-center text-2xl font-semibold">
          Jednoduché ceny
        </h2>
        <p className="text-muted-foreground mb-10 text-center text-sm">
          Orientačné ceny — finálne hodnoty doladíme. Free tier navždy.
        </p>
        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((p) => (
            <Card
              key={p.name}
              className={p.highlight ? "border-primary shadow-md" : undefined}
            >
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  {p.name}
                  {p.highlight && (
                    <span className="bg-primary text-primary-foreground rounded px-2 py-0.5 text-xs">
                      Obľúbené
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground text-sm">
                    {p.note}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                <ul className="grid gap-2 text-sm">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2">
                      <Check className="text-primary size-4" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={p.highlight ? "default" : "outline"}
                  className="mt-2 w-full"
                >
                  <Link href="/register">{p.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
