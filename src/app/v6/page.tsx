import type { Metadata } from "next"
import Link from "next/link"
import { Instrument_Serif } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { PLANS, PLAN_ORDER, type PlanTier } from "@/lib/billing/plans"

/*
 * v6 — „Private bank"
 * Hlboká navy, mosadz, rytecké dvojlinky, veľké tabulárne číslice.
 * Profilácia: prémiová značka — nástroj, ktorý si firma zaslúži. Vykanie.
 */

const instrument = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-v6",
})

export const metadata: Metadata = {
  title: "Synapse Faktúra — správa fakturácie pre náročných",
  description:
    "Presná DPH, e-faktúra 2027 a AI asistent v nástroji, ktorý pôsobí tak seriózne ako vaša firma.",
  robots: { index: false, follow: false },
}

const BG = "#0B1220"
const IVORY = "#EEE9DD"
const BRASS = "#C2A15C"
const MUTED = "#7C8496"
const RULE = "rgba(194,161,92,0.28)"

const TENETS = [
  {
    n: "DPH bez jedinej chyby",
    d: "Sadzby 23, 19 a 5 % podľa dátumu dodania a daňového režimu. Každý doklad prejde kontrolou náležitostí skôr, než opustí váš účet.",
  },
  {
    n: "Rok 2027 je už vyriešený",
    d: "Peppol a EN 16931 sú základom systému, nie doplnkom. Povinná e-faktúra pre platiteľov DPH vás zastihne pripravených.",
  },
  {
    n: "Asistent, ktorý pozná vaše čísla",
    d: "Faktúra jednou vetou, doklady vyťažené z fotografie, prehľad cash flow na požiadanie. Diskrétne a presne.",
  },
]

function price(tier: PlanTier) {
  return PLANS[tier].priceEur ?? "0"
}

/** Engraved double rule. */
function DoubleRule() {
  return (
    <div aria-hidden className="flex flex-col gap-[3px]">
      <span className="h-px w-full" style={{ backgroundColor: RULE }} />
      <span className="h-px w-full" style={{ backgroundColor: RULE }} />
    </div>
  )
}

export default function V6Page() {
  return (
    <div
      className={`${instrument.variable} min-h-screen`}
      style={{ backgroundColor: BG, color: IVORY }}
    >
      {/* Header */}
      <header className="mx-auto max-w-5xl px-6 pt-8">
        <div className="flex items-center justify-between pb-6">
          <Link
            href="/"
            className="text-sm font-medium tracking-[0.35em] uppercase"
            style={{ color: BRASS }}
          >
            Synapse Faktúra
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/login"
              className="underline-offset-4 hover:underline"
              style={{ color: MUTED }}
            >
              Prihlásiť sa
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 text-sm tracking-wide transition-colors hover:bg-[rgba(194,161,92,0.12)] focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: `1px solid ${BRASS}`, color: BRASS }}
            >
              Otvoriť účet
            </Link>
          </nav>
        </div>
        <DoubleRule />
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 pb-20 text-center">
        <p
          className="mb-8 text-xs font-medium tracking-[0.4em] uppercase"
          style={{ color: MUTED }}
        >
          Správa fakturácie · založené na Peppol · Slovensko
        </p>
        <h1
          className="text-5xl leading-[1.08] sm:text-7xl"
          style={{ fontFamily: "var(--font-v6)" }}
        >
          Vaše faktúry.
          <br />
          <span style={{ color: BRASS }}>Bez kompromisov.</span>
        </h1>
        <p
          className="mt-8 max-w-xl text-base leading-relaxed"
          style={{ color: MUTED }}
        >
          Faktúra hovorí o vašej firme viac, než si myslíte. Synapse Faktúra
          spája presnosť daňového poradcu s pohodlím osobného asistenta —
          vystavíte ju jednou vetou a každý detail sedí.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-5">
          <Link
            href="/register"
            className="px-8 py-3 text-sm font-medium tracking-[0.15em] uppercase transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: BRASS, color: BG }}
          >
            Otvoriť účet
          </Link>
          <Link
            href="#tarify"
            className="text-sm tracking-wide underline-offset-4 hover:underline"
            style={{ color: BRASS }}
          >
            Prehľad taríf
          </Link>
        </div>
        <p className="mt-6 text-xs" style={{ color: MUTED }}>
          Pro na 14 dní bez poplatku · bez viazanosti
        </p>
      </section>

      {/* Tenets */}
      <section className="mx-auto max-w-5xl px-6">
        <DoubleRule />
        <div className="grid gap-12 py-16 lg:grid-cols-3">
          {TENETS.map((t) => (
            <article key={t.n}>
              <h2
                className="mb-4 text-2xl leading-snug"
                style={{ fontFamily: "var(--font-v6)" }}
              >
                {t.n}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                {t.d}
              </p>
            </article>
          ))}
        </div>
        <DoubleRule />
      </section>

      {/* Numbers */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 text-center sm:grid-cols-3">
          {[
            ["23 / 19 / 5", "sadzby DPH, vždy podľa zákona"],
            ["2027", "e-faktúra vyriešená v predstihu"],
            ["1 veta", "toľko trvá vystavenie faktúry"],
          ].map(([n, d]) => (
            <div key={d}>
              <p
                className="text-5xl tabular-nums"
                style={{ fontFamily: "var(--font-v6)", color: BRASS }}
              >
                {n}
              </p>
              <p
                className="mt-2 text-xs tracking-[0.2em] uppercase"
                style={{ color: MUTED }}
              >
                {d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="tarify" className="mx-auto max-w-5xl px-6 pb-20">
        <DoubleRule />
        <div className="py-14">
          <h2
            className="text-center text-4xl"
            style={{ fontFamily: "var(--font-v6)" }}
          >
            Tarify
          </h2>
          <p className="mt-3 text-center text-sm" style={{ color: MUTED }}>
            Transparentné mesačné ceny. Zrušenie kedykoľvek, bez otázok.
          </p>
          <div
            className="mt-12 grid gap-px sm:grid-cols-3"
            style={{ backgroundColor: RULE }}
          >
            {PLAN_ORDER.map((tier) => {
              const plan = PLANS[tier]
              const featured = tier === "business"
              return (
                <div
                  key={tier}
                  className="flex flex-col items-center gap-5 px-8 py-12 text-center"
                  style={{ backgroundColor: featured ? "#101a2e" : BG }}
                >
                  <h3
                    className="text-xs font-medium tracking-[0.35em] uppercase"
                    style={{ color: featured ? BRASS : MUTED }}
                  >
                    {plan.label}
                  </h3>
                  <p className="flex items-baseline gap-1">
                    <span
                      className="text-6xl tabular-nums"
                      style={{ fontFamily: "var(--font-v6)" }}
                    >
                      {price(tier)}
                    </span>
                    <span className="text-sm" style={{ color: MUTED }}>
                      € {plan.priceEur ? "/ mes." : ""}
                    </span>
                  </p>
                  <p
                    className="min-h-16 text-sm leading-relaxed"
                    style={{ color: MUTED }}
                  >
                    {plan.blurb}
                  </p>
                  <Link
                    href="/register"
                    className="mt-auto px-6 py-2.5 text-xs font-medium tracking-[0.2em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={
                      featured
                        ? { backgroundColor: BRASS, color: BG }
                        : {
                            border: `1px solid ${BRASS}`,
                            color: BRASS,
                          }
                    }
                  >
                    {tier === "free" ? "Začať" : "Vyskúšať"}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
        <DoubleRule />
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <p
          className="text-3xl leading-snug sm:text-4xl"
          style={{ fontFamily: "var(--font-v6)" }}
        >
          Niektoré firmy fakturujú.
          <br />
          <span style={{ color: BRASS }}>Tie vaše doklady reprezentujú.</span>
        </p>
        <Link
          href="/register"
          className="mt-10 inline-block px-8 py-3 text-sm font-medium tracking-[0.15em] uppercase transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ backgroundColor: BRASS, color: BG }}
        >
          Otvoriť účet zadarmo
        </Link>
      </section>

      <div className="bg-background">
        <SiteFooter />
      </div>
    </div>
  )
}
