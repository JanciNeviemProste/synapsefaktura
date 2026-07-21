import type { Metadata } from "next"
import Link from "next/link"
import { Fraunces } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { PLANS, PLAN_ORDER, type PlanTier } from "@/lib/billing/plans"
import { featureLabel } from "@/lib/billing/feature-labels"

/*
 * v1 — „Švajčiarsky raster"
 * Papier, atrament, jedna červená. Faktúra ako typografický artefakt.
 * Profilácia: dôvera a precíznosť — faktúra je právny dokument.
 */

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-v1-display",
})

export const metadata: Metadata = {
  title: "Synapse Faktúra — presná fakturácia",
  description:
    "Faktúra je právny dokument. Synapse Faktúra ustráži DPH, náležitosti aj e-faktúru 2027.",
  robots: { index: false, follow: false },
}

const INK = "#161613"
const PAPER = "#FAFAF6"
const RED = "#C91F1F"
const RULE = "#E3E2DA"
const GRAY = "#77766E"

const PILLARS = [
  {
    label: "Náležitosti",
    title: "Každé povinné pole na svojom mieste",
    text: "IČO, DIČ, IČ DPH, dátum dodania, splatnosť. Systém nedovolí vystaviť doklad, ktorému niečo chýba — chyby sa opravujú pred odoslaním, nie po výzve z daňového úradu.",
  },
  {
    label: "DPH",
    title: "Sadzby 23 / 19 / 5 % bez počítania z hlavy",
    text: "Správna sadzba podľa dátumu a režimu (platiteľ, prenesenie povinnosti, oslobodenie). Historické doklady si držia sadzbu platnú v deň vystavenia.",
  },
  {
    label: "E-faktúra",
    title: "Peppol / EN 16931 od základu",
    text: "Od 1. 1. 2027 je elektronická faktúra povinná pre platiteľov DPH. Doklady zo Synapse sú štruktúrované správne už dnes — žiadna migrácia na poslednú chvíľu.",
  },
]

const FAQ = [
  {
    q: "Kedy začne platiť povinná e-faktúra?",
    a: "Od 1. 1. 2027 pre platiteľov DPH (novela zákona 222/2004 Z. z., model Peppol / IS EFA).",
  },
  {
    q: "Musím hneď platiť?",
    a: "Nie. Plán Free je zadarmo navždy (5 dokladov mesačne), Pro si vyskúšate 14 dní zdarma.",
  },
  {
    q: "Je to v súlade so slovenskou legislatívou?",
    a: "Áno — sadzby DPH 23/19/5 %, povinné náležitosti dokladov a Peppol / EN 16931 pre rok 2027.",
  },
  {
    q: "Môžem predplatné kedykoľvek zrušiť?",
    a: "Áno. Predplatné platí do konca zaplateného obdobia, bez viazanosti.",
  },
]

function price(tier: PlanTier) {
  return PLANS[tier].priceEur ? `${PLANS[tier].priceEur} €` : "0 €"
}

export default function V1Page() {
  return (
    <div
      className={`${fraunces.variable} min-h-screen`}
      style={{ backgroundColor: PAPER, color: INK }}
    >
      {/* Header */}
      <header
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
        style={{ borderBottom: `1px solid ${RULE}` }}
      >
        <Link href="/" className="flex items-baseline gap-2 font-medium">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: RED }}
            aria-hidden
          />
          Synapse Faktúra
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/login" className="hover:underline underline-offset-4">
            Prihlásiť sa
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: INK }}
          >
            Začať zadarmo
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-28">
        <div className="flex flex-col justify-center gap-6">
          <p
            className="text-xs font-medium tracking-[0.2em] uppercase"
            style={{ color: GRAY }}
          >
            Slovenská fakturácia · Peppol 2027
          </p>
          <h1
            className="text-4xl leading-[1.08] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-v1-display)", fontWeight: 560 }}
          >
            Faktúra je právny dokument.
            <br />
            <span style={{ color: RED }}>Nech podľa toho vyzerá.</span>
          </h1>
          <p className="max-w-md text-lg leading-relaxed" style={{ color: GRAY }}>
            Presné náležitosti, správna DPH a doklady pripravené na povinnú
            e-faktúru 2027. Vystavíte ju jednou vetou — o zvyšok sa postará AI.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: RED }}
            >
              Vystaviť prvú faktúru
            </Link>
            <Link
              href="#cennik"
              className="px-6 py-3 font-medium transition-colors hover:bg-black/5"
              style={{ border: `1px solid ${INK}` }}
            >
              Cenník
            </Link>
          </div>
          <p className="text-xs" style={{ color: GRAY }}>
            Bez platobnej karty · Pro 14 dní zdarma · Zrušenie kedykoľvek
          </p>
        </div>

        {/* Invoice specimen — the artifact */}
        <figure
          aria-label="Ukážka faktúry"
          className="relative flex flex-col gap-0 bg-white p-8 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.15)]"
          style={{ border: `1px solid ${RULE}` }}
        >
          <div
            className="flex items-baseline justify-between pb-4"
            style={{ borderBottom: `2px solid ${INK}` }}
          >
            <span
              className="text-2xl"
              style={{ fontFamily: "var(--font-v1-display)", fontWeight: 600 }}
            >
              Faktúra
            </span>
            <span className="font-mono text-base">č. 2026-0117</span>
          </div>

          <div
            className="grid grid-cols-2 gap-4 py-4 text-xs"
            style={{ borderBottom: `1px solid ${RULE}` }}
          >
            <div>
              <p className="mb-1 tracking-[0.15em] uppercase" style={{ color: GRAY }}>
                Dodávateľ
              </p>
              <p className="font-medium">Martin Kováč — KOVEX</p>
              <p style={{ color: GRAY }}>IČO 51 234 567 · IČ DPH SK1078563412</p>
            </div>
            <div>
              <p className="mb-1 tracking-[0.15em] uppercase" style={{ color: GRAY }}>
                Odberateľ
              </p>
              <p className="font-medium">Novastav s. r. o.</p>
              <p style={{ color: GRAY }}>IČO 44 891 023 · IČ DPH SK2023456789</p>
            </div>
          </div>

          <table className="w-full py-2 text-xs">
            <thead>
              <tr style={{ color: GRAY }}>
                <th className="py-2 text-left font-normal tracking-[0.15em] uppercase">
                  Položka
                </th>
                <th className="py-2 text-right font-normal tracking-[0.15em] uppercase">
                  Množstvo
                </th>
                <th className="py-2 text-right font-normal tracking-[0.15em] uppercase">
                  Spolu
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr style={{ borderTop: `1px solid ${RULE}` }}>
                <td className="py-2 font-sans">Elektroinštalačné práce</td>
                <td className="py-2 text-right">16 h</td>
                <td className="py-2 text-right">640,00 €</td>
              </tr>
              <tr style={{ borderTop: `1px solid ${RULE}` }}>
                <td className="py-2 font-sans">Revízna správa</td>
                <td className="py-2 text-right">1 ks</td>
                <td className="py-2 text-right">120,00 €</td>
              </tr>
            </tbody>
          </table>

          <div
            className="mt-auto flex items-end justify-between pt-4"
            style={{ borderTop: `2px solid ${INK}` }}
          >
            <div className="text-xs" style={{ color: GRAY }}>
              <p>Základ dane 760,00 €</p>
              <p>DPH 23 % — 174,80 €</p>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-[0.15em] uppercase" style={{ color: GRAY }}>
                K úhrade
              </p>
              <p className="font-mono text-2xl font-medium">934,80 €</p>
            </div>
          </div>

          <figcaption
            className="absolute top-[44%] right-8 -rotate-12 px-3 py-1 text-xs font-bold tracking-[0.25em] uppercase select-none"
            style={{ border: `2px solid ${RED}`, color: RED }}
          >
            Uhradené
          </figcaption>
        </figure>
      </section>

      {/* Pillars */}
      <section style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto grid max-w-6xl gap-px px-6 py-16 lg:grid-cols-3 lg:gap-12">
          {PILLARS.map((p) => (
            <article key={p.label} className="py-4">
              <p
                className="mb-3 text-xs font-medium tracking-[0.2em] uppercase"
                style={{ color: RED }}
              >
                {p.label}
              </p>
              <h2
                className="mb-3 text-xl leading-snug"
                style={{ fontFamily: "var(--font-v1-display)", fontWeight: 560 }}
              >
                {p.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: GRAY }}>
                {p.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing — price list, not cards */}
      <section id="cennik" style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2
            className="mb-2 text-3xl"
            style={{ fontFamily: "var(--font-v1-display)", fontWeight: 560 }}
          >
            Cenník
          </h2>
          <p className="mb-10 text-sm" style={{ color: GRAY }}>
            Jedna cena, žiadne hviezdičky. Pro na 14 dní zdarma, zrušenie kedykoľvek.
          </p>

          <div className="flex flex-col">
            {PLAN_ORDER.map((tier) => {
              const plan = PLANS[tier]
              const featured = tier === "pro"
              return (
                <div
                  key={tier}
                  className="grid items-baseline gap-4 py-6 sm:grid-cols-[8rem_1fr_auto_auto]"
                  style={{ borderTop: `1px solid ${RULE}` }}
                >
                  <h3 className="flex items-baseline gap-2 text-lg font-medium">
                    {plan.label}
                    {featured && (
                      <span
                        className="text-[10px] font-bold tracking-[0.2em] uppercase"
                        style={{ color: RED }}
                      >
                        Odporúčané
                      </span>
                    )}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: GRAY }}>
                    {plan.blurb}{" "}
                    {plan.docsPerMonth
                      ? `Limit ${plan.docsPerMonth} dokladov mesačne.`
                      : "Doklady bez obmedzenia."}
                  </p>
                  <p className="font-mono text-2xl">
                    {price(tier)}
                    <span className="text-xs" style={{ color: GRAY }}>
                      {plan.priceEur ? " /mes." : ""}
                    </span>
                  </p>
                  <Link
                    href="/register"
                    className="justify-self-start px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 sm:justify-self-end"
                    style={{
                      border: `1px solid ${featured ? RED : INK}`,
                      color: featured ? RED : INK,
                    }}
                  >
                    {tier === "free" ? "Začať zadarmo" : `Vyskúšať ${plan.label}`}
                  </Link>
                </div>
              )
            })}
          </div>

          <p className="mt-6 text-xs" style={{ color: GRAY }}>
            Pro zahŕňa: {[...PLANS.pro.features].map(featureLabel).join(", ")}.
            Business navyše:{" "}
            {[...PLANS.business.features]
              .filter((f) => !PLANS.pro.features.has(f))
              .map(featureLabel)
              .join(", ")}
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2
            className="mb-8 text-3xl"
            style={{ fontFamily: "var(--font-v1-display)", fontWeight: 560 }}
          >
            Časté otázky
          </h2>
          <div className="flex flex-col">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4" style={{ borderTop: `1px solid ${RULE}` }}>
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 font-medium">
                  {item.q}
                  <span
                    className="font-mono text-lg transition-transform group-open:rotate-45"
                    style={{ color: RED }}
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: GRAY }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ backgroundColor: INK }}>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 text-white sm:flex-row sm:items-center sm:justify-between">
          <h2
            className="max-w-xl text-3xl leading-tight"
            style={{ fontFamily: "var(--font-v1-display)", fontWeight: 560 }}
          >
            Prvú faktúru máte hotovú za dve minúty.
          </h2>
          <Link
            href="/register"
            className="shrink-0 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: RED }}
          >
            Vytvoriť účet zadarmo
          </Link>
        </div>
      </section>

      <div className="bg-background">
        <SiteFooter />
      </div>
    </div>
  )
}
