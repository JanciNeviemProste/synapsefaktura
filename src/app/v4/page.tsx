import type { Metadata } from "next"
import Link from "next/link"
import { IBM_Plex_Sans } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import {
  PLANS,
  PLAN_ORDER,
  type Feature,
  type PlanTier,
} from "@/lib/billing/plans"
import { featureLabel } from "@/lib/billing/feature-labels"

/*
 * v4 — „Kancelária"
 * Pokojná slate-modrá, hustá informačná sadzba, dátové tabuľky.
 * Profilácia: účtovné kancelárie — viac klientov pod jedným účtom. Vykanie.
 */

const plex = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-v4",
})

export const metadata: Metadata = {
  title: "Synapse Faktúra — pre účtovné kancelárie",
  description:
    "Všetci vaši klienti v jednej fakturácii. AI vyťažovanie dokladov, e-faktúra 2027 a audit trail.",
  robots: { index: false, follow: false },
}

const INK = "#131C26"
const BG = "#F4F6F8"
const BLUE = "#0F62FE"
const GRAY = "#5B6672"
const RULE = "#DDE2E8"

const CLIENTS = [
  {
    firm: "Novastav s. r. o.",
    docs: 34,
    vat: "platiteľ",
    peppol: "aktívne",
    ok: true,
  },
  {
    firm: "Pekáreň Vlčkovci",
    docs: 18,
    vat: "platiteľ",
    peppol: "aktívne",
    ok: true,
  },
  {
    firm: "M. Kováč — KOVEX",
    docs: 11,
    vat: "neplatiteľ",
    peppol: "—",
    ok: true,
  },
  {
    firm: "Ateliér Sova",
    docs: 7,
    vat: "platiteľ",
    peppol: "čaká na ID",
    ok: false,
  },
]

const PROPS = [
  {
    t: "Všetky firmy pod jedným účtom",
    d: "Medzi klientmi prepínate jedným klikom. Každá organizácia má vlastné doklady, číselné rady a nastavenia DPH — dáta sú striktne oddelené na úrovni databázy.",
  },
  {
    t: "Doklady klientov vyťaží AI",
    d: "Bločky a prijaté faktúry stačí odfotiť — AI prepíše sumy, DPH aj dodávateľa a zaradí ich do správnej firmy. Najväčší časožráč kancelárie zmizne.",
  },
  {
    t: "E-faktúra 2027 za všetkých klientov naraz",
    d: "Peppol / EN 16931 je vstavaný. Keď príde povinnosť, nezavádzate nový systém u dvadsiatich klientov — už v ňom pracujete.",
  },
  {
    t: "Poriadok, ktorý obhájite pri kontrole",
    d: "Audit trail zmien, správne sadzby DPH podľa dátumu dodania a povinné náležitosti na každom doklade. Bez výnimiek.",
  },
]

const TABLE_FEATURES: Feature[] = [
  "multiUser",
  "aiCapture",
  "assistant",
  "peppolSend",
  "advancedReports",
  "api",
]

function price(tier: PlanTier) {
  return PLANS[tier].priceEur ? `${PLANS[tier].priceEur} €` : "0 €"
}

export default function V4Page() {
  return (
    <div
      className={`${plex.variable} min-h-screen`}
      style={{ backgroundColor: BG, color: INK, fontFamily: "var(--font-v4)" }}
    >
      {/* Header */}
      <header
        className="bg-white"
        style={{ borderBottom: `1px solid ${RULE}` }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-2 font-semibold">
            Synapse Faktúra
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase"
              style={{ backgroundColor: BLUE }}
            >
              Kancelária
            </span>
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link
              href="/login"
              className="underline-offset-4 hover:underline"
              style={{ color: GRAY }}
            >
              Prihlásiť sa
            </Link>
            <Link
              href="/register"
              className="rounded-sm px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: BLUE }}
            >
              Založiť účet
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col gap-5">
          <p
            className="text-xs font-semibold tracking-[0.18em] uppercase"
            style={{ color: BLUE }}
          >
            Pre účtovné kancelárie a viacfiremných podnikateľov
          </p>
          <h1 className="text-4xl leading-[1.12] font-bold sm:text-5xl">
            Všetci vaši klienti.
            <br />
            Jedna fakturácia.
          </h1>
          <p
            className="max-w-md text-base leading-relaxed"
            style={{ color: GRAY }}
          >
            Spravujete doklady pre viac firiem? Synapse Faktúra ich drží pod
            jedným účtom — s AI vyťažovaním dokladov, prísnym oddelením dát a
            e-faktúrou 2027 pripravenou za všetkých naraz.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-sm px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: BLUE }}
            >
              Vyskúšať s prvým klientom
            </Link>
            <Link
              href="#cennik"
              className="rounded-sm px-5 py-2.5 font-semibold transition-colors hover:bg-white"
              style={{ border: `1px solid ${RULE}` }}
            >
              Cenník pre kancelárie
            </Link>
          </div>
          <p className="text-xs" style={{ color: GRAY }}>
            Business plán na 14 dní zdarma · bez viazanosti
          </p>
        </div>

        {/* Client ledger artifact */}
        <figure
          aria-label="Prehľad klientov v aplikácii"
          className="overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(19,28,38,0.06),0_16px_48px_-16px_rgba(19,28,38,0.18)]"
          style={{ border: `1px solid ${RULE}` }}
        >
          <div
            className="flex items-center justify-between px-5 py-3 text-sm font-semibold"
            style={{ borderBottom: `1px solid ${RULE}` }}
          >
            Moji klienti
            <span className="text-xs font-medium" style={{ color: GRAY }}>
              júl 2026
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs uppercase"
                style={{ color: GRAY }}
              >
                <th className="px-5 py-2.5 font-medium">Firma</th>
                <th className="px-2 py-2.5 text-right font-medium">Doklady</th>
                <th className="px-2 py-2.5 font-medium">DPH</th>
                <th className="px-5 py-2.5 font-medium">E-faktúra</th>
              </tr>
            </thead>
            <tbody>
              {CLIENTS.map((c) => (
                <tr key={c.firm} style={{ borderTop: `1px solid ${RULE}` }}>
                  <td className="px-5 py-3 font-medium">{c.firm}</td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {c.docs}
                  </td>
                  <td className="px-2 py-3" style={{ color: GRAY }}>
                    {c.vat}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{
                          backgroundColor: c.ok ? "#12805C" : "#B78103",
                        }}
                      />
                      <span style={{ color: GRAY }}>{c.peppol}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption
            className="px-5 py-3 text-xs"
            style={{ borderTop: `1px solid ${RULE}`, color: GRAY }}
          >
            Ilustračný náhľad — prepínanie medzi organizáciami jedným klikom.
          </figcaption>
        </figure>
      </section>

      {/* Value props */}
      <section className="bg-white" style={{ borderTop: `1px solid ${RULE}` }}>
        <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-6 py-16 sm:grid-cols-2">
          {PROPS.map((p) => (
            <article key={p.t} className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">
                <span aria-hidden className="mr-2" style={{ color: BLUE }}>
                  §
                </span>
                {p.t}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: GRAY }}>
                {p.d}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Pricing table */}
      <section id="cennik" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-2 text-2xl font-bold">Cenník</h2>
        <p
          className="mb-8 max-w-xl text-sm leading-relaxed"
          style={{ color: GRAY }}
        >
          Pre kancelárie odporúčame Business — viac používateľov, odosielanie
          e-faktúr a API. Každý plán vyskúšate 14 dní zdarma.
        </p>
        <div
          className="overflow-x-auto rounded-md bg-white"
          style={{ border: `1px solid ${RULE}` }}
        >
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr style={{ borderBottom: `2px solid ${INK}` }}>
                <th className="px-5 py-4 text-left font-semibold">Funkcia</th>
                {PLAN_ORDER.map((t) => (
                  <th
                    key={t}
                    className="px-4 py-4 text-center font-semibold"
                    style={t === "business" ? { color: BLUE } : undefined}
                  >
                    {PLANS[t].label}
                    <span className="block text-lg font-bold tabular-nums">
                      {price(t)}
                      <span
                        className="text-xs font-medium"
                        style={{ color: GRAY }}
                      >
                        {PLANS[t].priceEur ? "/mes" : ""}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                <td className="px-5 py-3">Doklady mesačne</td>
                {PLAN_ORDER.map((t) => (
                  <td key={t} className="px-4 py-3 text-center tabular-nums">
                    {PLANS[t].docsPerMonth === null
                      ? "neobmedzené"
                      : PLANS[t].docsPerMonth}
                  </td>
                ))}
              </tr>
              {TABLE_FEATURES.map((f) => (
                <tr key={f} style={{ borderBottom: `1px solid ${RULE}` }}>
                  <td className="px-5 py-3">{featureLabel(f)}</td>
                  {PLAN_ORDER.map((t) => (
                    <td key={t} className="px-4 py-3 text-center">
                      {PLANS[t].features.has(f) ? (
                        <span style={{ color: "#12805C" }}>✓</span>
                      ) : (
                        <span style={{ color: RULE }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="px-5 py-4" />
                {PLAN_ORDER.map((t) => (
                  <td key={t} className="px-4 py-4 text-center">
                    <Link
                      href="/register"
                      className="inline-block rounded-sm px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={
                        t === "business"
                          ? { backgroundColor: BLUE, color: "white" }
                          : { border: `1px solid ${RULE}`, color: INK }
                      }
                    >
                      {t === "free"
                        ? "Začať zadarmo"
                        : `Vyskúšať ${PLANS[t].label}`}
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ backgroundColor: INK }}>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 text-white sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">
              Prvého klienta máte v systéme za 10 minút.
            </h2>
            <p className="mt-1 text-sm opacity-70">
              Vyskúšajte s jednou firmou — ďalšie pridáte, keď to bude dávať
              zmysel.
            </p>
          </div>
          <Link
            href="/register"
            className="shrink-0 rounded-sm px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: BLUE }}
          >
            Založiť účet zadarmo
          </Link>
        </div>
      </section>

      <div className="bg-background">
        <SiteFooter />
      </div>
    </div>
  )
}
