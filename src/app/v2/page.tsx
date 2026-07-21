import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/components/site-footer"
import { PLANS, PLAN_ORDER, type PlanTier } from "@/lib/billing/plans"

/*
 * v2 — „Terminál"
 * Tmavý monospace svet, jantárový fosfor CRT. Fakturácia ako príkazový riadok.
 * Profilácia: AI-first — napíš vetu, systém ju vykoná.
 */

export const metadata: Metadata = {
  title: "Synapse Faktúra — fakturuj jedným príkazom",
  description:
    "Napíš vetu, dostaneš faktúru. AI fakturácia pre živnostníkov, pripravená na Peppol 2027.",
  robots: { index: false, follow: false },
}

const BG = "#0D0B07"
const PANEL = "#161209"
const AMBER = "#FFB000"
const AMBER_DIM = "#8A6A1F"
const TEXT = "#E6D9BC"
const MUTED = "#8D8168"
const RULE = "#2A2314"

const COMMANDS = [
  {
    cmd: "vyfakturuj Novákovi 3 hodiny konzultácie po 50 €",
    out: [
      "✓ faktúra 2026-0042 · Ján Novák",
      "✓ 3 × konzultácia à 50,00 € · DPH 23 %",
      "✓ spolu 184,50 € · splatnosť 14 dní",
    ],
    note: "Fakturácia vetou — AI rozumie po slovensky.",
  },
  {
    cmd: "vyťaž bloček.jpg",
    out: [
      "✓ Slovnaft · 21. 7. 2026 · nafta",
      "✓ základ 54,47 € · DPH 23 % · spolu 67,00 €",
      "✓ zaradené do nákladov",
    ],
    note: "Odfoť bloček alebo faktúru — AI prepíše všetko za teba.",
  },
  {
    cmd: "kto mi ešte nezaplatil?",
    out: [
      "! Novastav s.r.o. · 934,80 € · 12 dní po splatnosti",
      "→ upomienka pripravená na odoslanie",
    ],
    note: "Asistent pozná tvoje čísla a upomienky pošle za teba.",
  },
]

const SPECS = [
  ["DPH", "23 / 19 / 5 % podľa dátumu a režimu"],
  ["E-faktúra", "Peppol / EN 16931, povinné od 1. 1. 2027"],
  ["Jazyky", "SK · CZ · EN — rozhranie aj doklady"],
  ["Export", "PDF s QR platbou (PAY by square)"],
] as const

function price(tier: PlanTier) {
  return PLANS[tier].priceEur ? `${PLANS[tier].priceEur} €/mes` : "0 €"
}

export default function V2Page() {
  return (
    <div
      className="min-h-screen font-mono text-[15px]"
      style={{ backgroundColor: BG, color: TEXT }}
    >
      {/* Header */}
      <header
        className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6 text-sm"
        style={{ borderBottom: `1px solid ${RULE}` }}
      >
        <Link href="/" className="tracking-tight">
          <span style={{ color: AMBER }}>synapse</span>
          <span style={{ color: MUTED }}>@</span>faktura
          <span style={{ color: MUTED }}>:~$</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/login" style={{ color: MUTED }} className="hover:underline underline-offset-4">
            login
          </Link>
          <Link
            href="/register"
            className="px-3 py-1.5 font-bold transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: AMBER, color: BG }}
          >
            ./start --free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <p className="mb-4 text-xs tracking-[0.25em] uppercase" style={{ color: MUTED }}>
          Slovenská AI fakturácia · Peppol 2027 ready
        </p>
        <h1 className="max-w-3xl text-3xl leading-snug font-bold sm:text-5xl sm:leading-snug">
          Napíš vetu.
          <br />
          <span style={{ color: AMBER }}>Dostaneš faktúru.</span>
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed" style={{ color: MUTED }}>
          Žiadne klikanie cez desať formulárov. Povieš, čo fakturuješ — Synapse
          doklad vystaví, skontroluje DPH a pošle. Bločky vyťaží z fotky.
        </p>

        {/* Terminal window */}
        <div
          className="mt-10 overflow-hidden"
          style={{ border: `1px solid ${RULE}`, backgroundColor: PANEL }}
        >
          <div
            className="flex items-center gap-2 px-4 py-2.5 text-xs"
            style={{ borderBottom: `1px solid ${RULE}`, color: MUTED }}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: RULE }} />
            <span className="size-2.5 rounded-full" style={{ backgroundColor: RULE }} />
            <span className="size-2.5 rounded-full" style={{ backgroundColor: AMBER_DIM }} />
            <span className="ml-2">synapse — fakturácia</span>
          </div>
          <div className="flex flex-col gap-1.5 p-5 text-sm leading-relaxed sm:p-6">
            <p>
              <span style={{ color: AMBER }}>$</span> vyfakturuj Novákovi 3 hodiny
              konzultácie po 50 €
              <span
                aria-hidden
                className="ml-1 inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] animate-pulse motion-reduce:animate-none"
                style={{ backgroundColor: AMBER }}
              />
            </p>
            <p style={{ color: MUTED }}>✓ faktúra 2026-0042 vystavená · Ján Novák</p>
            <p style={{ color: MUTED }}>✓ 3 × konzultácia à 50,00 € · DPH 23 % = 34,50 €</p>
            <p style={{ color: MUTED }}>
              ✓ spolu <span style={{ color: TEXT }}>184,50 €</span> · QR platba · PDF
              odoslané
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/register"
            className="px-5 py-2.5 font-bold transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: AMBER, color: BG }}
          >
            Vyskúšať zadarmo →
          </Link>
          <span style={{ color: MUTED }}>
            # bez karty · Pro 14 dní zdarma · zrušíš kedykoľvek
          </span>
        </div>
      </section>

      {/* Commands showcase */}
      <section style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-8 text-xl font-bold">
            <span style={{ color: MUTED }}>##</span> Čo všetko vybavíš jednou vetou
          </h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {COMMANDS.map((c) => (
              <article
                key={c.cmd}
                className="flex flex-col gap-3 p-5 text-[13px] leading-relaxed"
                style={{ border: `1px solid ${RULE}`, backgroundColor: PANEL }}
              >
                <p className="break-words">
                  <span style={{ color: AMBER }}>$</span> {c.cmd}
                </p>
                <div style={{ color: MUTED }}>
                  {c.out.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                <p className="mt-auto pt-2 text-xs" style={{ color: AMBER_DIM }}>
                  — {c.note}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Specs */}
      <section style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-8 text-xl font-bold">
            <span style={{ color: MUTED }}>##</span> Technické parametre
          </h2>
          <dl className="grid gap-x-12 gap-y-4 text-sm sm:grid-cols-2">
            {SPECS.map(([k, v]) => (
              <div
                key={k}
                className="flex items-baseline justify-between gap-6 py-2"
                style={{ borderBottom: `1px dashed ${RULE}` }}
              >
                <dt style={{ color: AMBER }}>{k}</dt>
                <dd className="text-right" style={{ color: MUTED }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Pricing */}
      <section id="cennik" style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-2 text-xl font-bold">
            <span style={{ color: MUTED }}>##</span> Cenník
          </h2>
          <p className="mb-8 text-sm" style={{ color: MUTED }}>
            $ synapse plans --list
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            {PLAN_ORDER.map((tier) => {
              const plan = PLANS[tier]
              const featured = tier === "pro"
              return (
                <div
                  key={tier}
                  className="flex flex-col gap-4 p-5"
                  style={{
                    border: `1px solid ${featured ? AMBER : RULE}`,
                    backgroundColor: PANEL,
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-bold" style={{ color: featured ? AMBER : TEXT }}>
                      --{plan.tier}
                    </h3>
                    {featured && (
                      <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: AMBER }}>
                        odporúčané
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold">{price(tier)}</p>
                  <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                    {plan.blurb}
                  </p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    doklady:{" "}
                    <span style={{ color: TEXT }}>
                      {plan.docsPerMonth === null ? "∞" : `${plan.docsPerMonth}/mes`}
                    </span>
                  </p>
                  <Link
                    href="/register"
                    className="mt-auto px-4 py-2 text-center text-sm font-bold transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={
                      featured
                        ? { backgroundColor: AMBER, color: BG }
                        : { border: `1px solid ${AMBER_DIM}`, color: TEXT }
                    }
                  >
                    {tier === "free" ? "./start --free" : `./trial --${plan.tier}`}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 2027 + final CTA */}
      <section style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16">
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
            <span style={{ color: AMBER }}>!</span> deadline: od{" "}
            <span style={{ color: TEXT }}>1. 1. 2027</span> je e-faktúra povinná pre
            platiteľov DPH (Peppol / IS EFA). Synapse ju posiela natívne — ty
            nemusíš riešiť nič.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="px-5 py-2.5 font-bold transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: AMBER, color: BG }}
            >
              Vytvoriť účet zadarmo →
            </Link>
            <Link
              href="/e-faktura-2027"
              className="text-sm hover:underline underline-offset-4"
              style={{ color: MUTED }}
            >
              man e-faktura-2027
            </Link>
          </div>
        </div>
      </section>

      <div className="bg-background font-sans">
        <SiteFooter />
      </div>
    </div>
  )
}
