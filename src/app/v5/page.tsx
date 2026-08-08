import type { Metadata } from "next"
import Link from "next/link"
import { Bricolage_Grotesque } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { PLANS, type PlanTier } from "@/lib/billing/plans"

/*
 * v5 — „Remeslo"
 * Teplý ľan, borovicová zelená, ručné podčiarknutia. Deň remeselníka ako príbeh.
 * Profilácia: živnostník-remeselník — fakturácia po pracovnom dni, tykanie.
 */

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-v5",
})

export const metadata: Metadata = {
  title: "Synapse Faktúra — faktúra hotová, kým dopiješ kávu",
  description:
    "Fakturácia pre remeselníkov a živnostníkov: jednou vetou z mobilu, bločky odfotíš, hotovo.",
  robots: { index: false, follow: false },
}

const PAPER = "#F5EFE3"
const INK = "#2A2418"
const PINE = "#1F5138"
const CLAY = "#8C8371"
const CARD = "#FDFAF2"
const RULE = "#E2DAC8"

const DAY = [
  { time: "6:40", text: "Náradie do dodávky, kávu do ruky. Ideš na stavbu." },
  {
    time: "12:15",
    text: "Obed. Odfotíš bloček z pumpy — AI ho prečíta a vyplní, ty len skontroluješ a potvrdíš.",
  },
  { time: "17:50", text: "Hotovo, balíš. Zákazník spokojný, ty tiež." },
  {
    time: "18:03",
    text: "„Vyfakturuj Beňovi obklad kúpeľne, 24 hodín po 28 €.“ Koncept faktúry s QR platbou máš na obrazovke — prezrieš, vystavíš a odošleš z mobilu, kým si vyšiel z dvora.",
    highlight: true,
  },
  { time: "18:05", text: "Večer máš voľno. Papiere neexistujú." },
]

const PROMISES = [
  {
    t: "Faktúra jednou vetou",
    d: "Povieš, čo si robil — AI pripraví koncept aj s položkami, zákazníkom a DPH. Ty ho len prejdeš a vystavíš. Z mobilu, z dodávky, odkiaľkoľvek.",
  },
  {
    t: "Bločky prepíše AI",
    d: "Odfotíš, AI vyplní údaje, ty ich potvrdíš. Žiadne večerné prepisovanie krabice účteniek.",
  },
  {
    t: "Peniaze si ťa nájdu",
    d: "QR platba na faktúre, automatické upomienky na neplatičov. Ty sa venuj robote.",
  },
]

function price(tier: PlanTier) {
  return PLANS[tier].priceEur ? `${PLANS[tier].priceEur} €` : "0 €"
}

/** Hand-drawn underline stroke. */
function Underline({ color = PINE }: { color?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 12"
      className="absolute -bottom-1 left-0 w-full"
      preserveAspectRatio="none"
    >
      <path
        d="M3 9 C 40 3, 90 2, 130 5 S 200 10, 217 6"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function V5Page() {
  return (
    <div
      className={`${bricolage.variable} min-h-screen`}
      style={{
        backgroundColor: PAPER,
        color: INK,
        fontFamily: "var(--font-v5)",
      }}
    >
      {/* Header */}
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold">
          Synapse Faktúra
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link
            href="/login"
            className="underline-offset-4 hover:underline"
            style={{ color: CLAY }}
          >
            Prihlásiť sa
          </Link>
          <Link
            href="/register"
            className="rounded-full px-5 py-2 font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: PINE }}
          >
            Vyskúšať zadarmo
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-14 text-center sm:pt-24">
        <p
          className="mb-4 text-sm font-semibold tracking-wide"
          style={{ color: PINE }}
        >
          Pre remeselníkov, majstrov a živnostníkov
        </p>
        <h1 className="text-4xl leading-[1.15] font-bold sm:text-6xl">
          Faktúra hotová,
          <br />
          kým{" "}
          <span className="relative inline-block">
            dopiješ kávu
            <Underline />
          </span>
          .
        </h1>
        <p
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed"
          style={{ color: CLAY }}
        >
          Celý deň makáš rukami — večer si nezaslúžiš papierovačky. Faktúru
          nadiktuješ jednou vetou, bločky odfotíš a máš pokoj. Aj s e-faktúrou
          2027.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full px-7 py-3.5 text-base font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: PINE }}
          >
            Vystaviť prvú faktúru
          </Link>
          <Link
            href="#den"
            className="rounded-full px-7 py-3.5 text-base font-semibold transition-colors hover:bg-black/5"
            style={{ border: `2px solid ${INK}` }}
          >
            Ako to vyzerá v praxi
          </Link>
        </div>
        <p className="mt-4 text-xs" style={{ color: CLAY }}>
          Zadarmo do 5 dokladov mesačne · bez platobnej karty
        </p>
      </section>

      {/* Day timeline */}
      <section id="den" className="mx-auto max-w-2xl px-6 py-14">
        <h2 className="mb-10 text-center text-2xl font-bold sm:text-3xl">
          Utorok s Synapse Faktúrou
        </h2>
        <ol
          className="relative flex flex-col gap-7 pl-8"
          style={{ borderLeft: `3px solid ${RULE}` }}
        >
          {DAY.map((step) => (
            <li key={step.time} className="relative">
              <span
                aria-hidden
                className="absolute top-1.5 -left-[2.45rem] size-4 rounded-full"
                style={{
                  backgroundColor: step.highlight ? PINE : PAPER,
                  border: `3px solid ${step.highlight ? PINE : CLAY}`,
                }}
              />
              <p
                className="text-sm font-bold tabular-nums"
                style={{ color: step.highlight ? PINE : CLAY }}
              >
                {step.time}
              </p>
              <p
                className={
                  step.highlight ? "mt-1 rounded-xl p-4 font-medium" : "mt-1"
                }
                style={
                  step.highlight
                    ? { backgroundColor: CARD, border: `1px solid ${RULE}` }
                    : { color: INK }
                }
              >
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Promises */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <article
              key={p.t}
              className="rounded-2xl p-6"
              style={{ backgroundColor: CARD, border: `1px solid ${RULE}` }}
            >
              <h3 className="relative mb-3 inline-block text-lg font-bold">
                {p.t}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: CLAY }}>
                {p.d}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing — simple, Free vs Pro focus */}
      <section id="cennik" className="mx-auto max-w-3xl px-6 py-14 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">Poctivé ceny</h2>
        <p
          className="mx-auto mt-2 max-w-md text-sm leading-relaxed"
          style={{ color: CLAY }}
        >
          Začneš zadarmo. Keď ti fakturácia vetou prirastie k srdcu, Pro stojí
          menej ako jedna hodina tvojej práce.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {(["free", "pro"] as const).map((tier) => {
            const plan = PLANS[tier]
            const featured = tier === "pro"
            return (
              <div
                key={tier}
                className="flex flex-col gap-4 rounded-2xl p-7 text-left"
                style={{
                  backgroundColor: featured ? PINE : CARD,
                  color: featured ? PAPER : INK,
                  border: `1px solid ${featured ? PINE : RULE}`,
                }}
              >
                <h3 className="text-lg font-bold">{plan.label}</h3>
                <p className="text-4xl font-bold">
                  {price(tier)}
                  <span className="text-sm font-medium opacity-70">
                    {plan.priceEur ? " / mesiac" : " navždy"}
                  </span>
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: featured ? "#CDE0D3" : CLAY }}
                >
                  {featured
                    ? "Neobmedzené faktúry + celá AI: fakturácia vetou, bločky z fotky, asistent aj múdre upomienky. Prvých 14 dní zdarma."
                    : "5 dokladov mesačne, príjem e-faktúr a QR platby. Ideálny štart, žiadny záväzok."}
                </p>
                <Link
                  href="/register"
                  className="mt-auto rounded-full px-5 py-2.5 text-center text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={
                    featured
                      ? { backgroundColor: PAPER, color: PINE }
                      : { backgroundColor: PINE, color: PAPER }
                  }
                >
                  {featured ? "Vyskúšať Pro na 14 dní" : "Začať zadarmo"}
                </Link>
              </div>
            )
          })}
        </div>
        <p className="mt-6 text-xs" style={{ color: CLAY }}>
          Máš viac firiem alebo účtovníčku? Business za {price("business")}/mes
          pridá ďalších používateľov, odosielanie e-faktúr a API.
        </p>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-6 pt-6 pb-20 text-center">
        <div
          className="rounded-3xl px-8 py-12"
          style={{ backgroundColor: CARD, border: `1px solid ${RULE}` }}
        >
          <h2 className="text-2xl leading-snug font-bold sm:text-3xl">
            Dnes večer už{" "}
            <span className="relative inline-block">
              nefakturuješ
              <Underline />
            </span>
            .<br />
            Len to povieš.
          </h2>
          <Link
            href="/register"
            className="mt-7 inline-block rounded-full px-8 py-3.5 font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: PINE }}
          >
            Vytvoriť účet zadarmo
          </Link>
          <p className="mt-3 text-xs" style={{ color: CLAY }}>
            Hotové za 2 minúty, ako dobrá malta.
          </p>
        </div>
      </section>

      <div className="bg-background">
        <SiteFooter />
      </div>
    </div>
  )
}
