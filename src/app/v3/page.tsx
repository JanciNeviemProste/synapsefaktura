import type { Metadata } from "next"
import Link from "next/link"
import { Archivo } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { PLANS, PLAN_ORDER, type PlanTier } from "@/lib/billing/plans"
import { Countdown } from "./countdown"

/*
 * v3 — „Deadline 2027"
 * Biela, čierna, výstražná žltá. Countdown ako hlavný artefakt.
 * Profilácia: compliance urgencia — povinná e-faktúra sa blíži.
 */

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-v3",
})

export const metadata: Metadata = {
  title: "Synapse Faktúra — priprav sa na e-faktúru 2027",
  description:
    "Od 1. 1. 2027 je e-faktúra povinná pre platiteľov DPH. Priprav sa dnes, nie na poslednú chvíľu.",
  robots: { index: false, follow: false },
}

const INK = "#0D0D0C"
const YELLOW = "#FFD500"
const GRAY = "#5C5C57"
const RULE = "#E6E6E1"

const FACTS = [
  {
    k: "Koho sa to týka",
    v: "Každého platiteľa DPH na Slovensku — bez ohľadu na veľkosť firmy.",
  },
  {
    k: "Čo sa mení",
    v: "Faktúra už nebude PDF ani papier, ale štruktúrovaný dokument (UBL / EN 16931) posielaný cez sieť Peppol.",
  },
  {
    k: "Kto na to dohliada",
    v: "Finančná správa — údaje z faktúr sa budú reportovať štátu (model IS EFA).",
  },
  {
    k: "Čo hrozí",
    v: "Za nevystavenie e-faktúry v zákonnom formáte hrozia pokuty ako pri iných daňových povinnostiach.",
  },
]

const CHECKLIST = [
  {
    t: "Prejdi na softvér, ktorý vie Peppol",
    d: "Synapse Faktúra je na EN 16931 / UBL 2.1 postavená od základu — e-faktúru posiela natívne, nie cez dodatočný modul.",
  },
  {
    t: "Preneste si číselné rady a kontakty",
    d: "Import kontaktov a nastavenie číslovania zaberie pár minút. Historické doklady si držia pôvodné sadzby DPH.",
  },
  {
    t: "Fakturuj normálne ďalej",
    d: "Vystavuješ ako doteraz — jednou vetou cez AI alebo klasicky. Formát 2027 rieši systém na pozadí.",
  },
  {
    t: "V januári 2027 nerieš nič",
    d: "Kým iní budú migrovať v strese, ty už budeš mať za sebou mesiace bežnej prevádzky.",
  },
]

function price(tier: PlanTier) {
  return PLANS[tier].priceEur ? `${PLANS[tier].priceEur} €` : "0 €"
}

function HazardStripe() {
  return (
    <div
      aria-hidden
      className="h-3 w-full"
      style={{
        backgroundImage: `repeating-linear-gradient(-45deg, ${INK} 0 14px, ${YELLOW} 14px 28px)`,
      }}
    />
  )
}

export default function V3Page() {
  return (
    <div
      className={`${archivo.variable} min-h-screen bg-white`}
      style={{ color: INK, fontFamily: "var(--font-v3)" }}
    >
      {/* Header */}
      <header style={{ backgroundColor: INK }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6 text-white">
          <Link href="/" className="text-sm font-bold tracking-wide uppercase">
            Synapse&nbsp;Faktúra
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/login"
              className="underline-offset-4 opacity-80 hover:underline hover:opacity-100"
            >
              Prihlásiť sa
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 font-bold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: YELLOW, color: INK }}
            >
              Pripraviť sa
            </Link>
          </nav>
        </div>
      </header>
      <HazardStripe />

      {/* Hero — countdown */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-14 text-center sm:pt-24">
        <p
          className="mb-3 text-xs font-bold tracking-[0.25em] uppercase"
          style={{ color: GRAY }}
        >
          Novela zákona č. 222/2004 Z. z. · Peppol / IS EFA
        </p>
        <p
          className="text-[clamp(6rem,20vw,13rem)] leading-none font-black tracking-tight tabular-nums"
          style={{ fontFamily: "var(--font-v3)" }}
        >
          <Countdown />
        </p>
        <p className="text-lg font-bold tracking-wide uppercase">
          dní do povinnej e-faktúry
        </p>
        <h1 className="mx-auto mt-8 max-w-2xl text-2xl leading-snug font-black sm:text-4xl">
          Od 1. januára 2027 musí každý platiteľ DPH posielať faktúry
          elektronicky.
        </h1>
        <p
          className="mx-auto mt-4 max-w-xl text-base leading-relaxed"
          style={{ color: GRAY }}
        >
          Nie PDF. Nie papier. Štruktúrovaná e-faktúra cez sieť Peppol, s
          reportingom Finančnej správe. Kto sa pripraví teraz, v roku 2027
          nerieši nič.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="px-6 py-3 text-base font-black uppercase transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: YELLOW, color: INK }}
          >
            Pripraviť sa zadarmo
          </Link>
          <Link
            href="/e-faktura-2027"
            className="px-6 py-3 text-base font-bold underline-offset-4 hover:underline"
            style={{ border: `2px solid ${INK}` }}
          >
            Čo presne sa mení?
          </Link>
        </div>
      </section>

      <HazardStripe />

      {/* Facts */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-8 text-2xl font-black uppercase">
          Fakty, nie panika
        </h2>
        <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {FACTS.map((f) => (
            <div
              key={f.k}
              className="pt-4"
              style={{ borderTop: `3px solid ${INK}` }}
            >
              <dt className="mb-1 font-black uppercase">{f.k}</dt>
              <dd className="text-sm leading-relaxed" style={{ color: GRAY }}>
                {f.v}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Checklist */}
      <section style={{ backgroundColor: "#F7F7F3" }}>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-2 text-2xl font-black uppercase">Plán prípravy</h2>
          <p className="mb-10 text-sm" style={{ color: GRAY }}>
            Štyri kroky — poradie je dôležité, preto sú číslované.
          </p>
          <ol className="grid gap-6 sm:grid-cols-2">
            {CHECKLIST.map((item, i) => (
              <li
                key={item.t}
                className="flex gap-4 bg-white p-5"
                style={{ border: `1px solid ${RULE}` }}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center text-lg font-black"
                  style={{ backgroundColor: YELLOW }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="mb-1 font-bold">{item.t}</h3>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: GRAY }}
                  >
                    {item.d}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing strip */}
      <section id="cennik" className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-2 text-2xl font-black uppercase">
          Začni dnes, plať až keď rastieš
        </h2>
        <p className="mb-10 text-sm" style={{ color: GRAY }}>
          Free navždy zadarmo vrátane príjmu e-faktúr. Pro na 14 dní zdarma.
        </p>
        <div
          className="grid gap-0 sm:grid-cols-3"
          style={{ border: `2px solid ${INK}` }}
        >
          {PLAN_ORDER.map((tier, i) => {
            const plan = PLANS[tier]
            const featured = tier === "pro"
            return (
              <div
                key={tier}
                className="flex flex-col gap-3 p-6"
                style={{
                  borderLeft: i > 0 ? `2px solid ${INK}` : undefined,
                  backgroundColor: featured ? YELLOW : "white",
                }}
              >
                <h3 className="font-black uppercase">{plan.label}</h3>
                <p className="text-4xl font-black tabular-nums">
                  {price(tier)}
                  <span className="text-sm font-bold">
                    {plan.priceEur ? "/mes" : ""}
                  </span>
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: featured ? INK : GRAY }}
                >
                  {plan.blurb}
                </p>
                <Link
                  href="/register"
                  className="mt-auto inline-block px-4 py-2 text-center text-sm font-black uppercase transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: INK, color: "white" }}
                >
                  {tier === "free" ? "Začať zadarmo" : `Vyskúšať ${plan.label}`}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      <HazardStripe />

      {/* Final CTA */}
      <section style={{ backgroundColor: INK }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 py-16 text-center text-white">
          <h2 className="max-w-2xl text-3xl leading-tight font-black uppercase">
            2027 nepočká. Ty už môžeš mať hotovo.
          </h2>
          <Link
            href="/register"
            className="px-8 py-3 text-lg font-black uppercase transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: YELLOW, color: INK }}
          >
            Vytvoriť účet zadarmo
          </Link>
          <p className="text-xs opacity-70">
            Hotové za 2 minúty · bez platobnej karty
          </p>
        </div>
      </section>

      <div className="bg-background">
        <SiteFooter />
      </div>
    </div>
  )
}
