import Link from "next/link"
import { Check, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"
import { HeroVideo } from "@/components/landing/hero-video"
import { LandingNav } from "@/components/landing/landing-nav"
import { Hero } from "@/components/landing/hero"
import { PLANS, PLAN_ORDER, type Feature, type PlanTier } from "@/lib/billing/plans"
import { featureLabel } from "@/lib/billing/feature-labels"

/**
 * Úvodná stránka.
 *
 * Prvá obrazovka je hero s postavou na pozadí, ktorá reaguje na pohyb myši.
 * Pod ňou pokračuje obsah v tom istom jazyku — veľká typografia, vlasové
 * linky namiesto rámčekov, pilulkové tlačidlá, veľa vzduchu.
 *
 * Video je `position: fixed`, takže všetko pod hero musí mať vlastné nepriehľadné
 * pozadie a vyššiu vrstvu — inak by pri scrollovaní presvitalo.
 */

const FEATURES = [
  {
    n: "01",
    title: "AI píše faktúry za teba",
    text: "Povedz jednou vetou, čo fakturuješ — AI pripraví koncept, ty ho skontroluješ a vystavíš. Bločky a prijaté faktúry vyťaží z fotky na tvoje potvrdenie. Asistent odpovie na otázky o tvojich financiách.",
  },
  {
    n: "02",
    title: "Nikdy nepošleš zlú faktúru",
    text: "Kontrola DPH (23/19/5 %) a povinných náležitostí ešte pred odoslaním. Žiadne dodatočné opravy ani starosti s daňovým úradom.",
  },
  {
    n: "03",
    title: "Na 2027 pripravený skôr než ostatní",
    text: "Postavené na Peppol / EN 16931 od základu. Keď príde povinná e-faktúra, ty už budeš mať hotovo.",
  },
]

/** Highlighted bullet lines per plan for the pricing columns. */
const PLAN_HIGHLIGHTS: Record<PlanTier, string[]> = {
  free: ["5 dokladov / mesiac", "Príjem e-faktúr (Peppol)", "1 používateľ"],
  pro: ["Neobmedzené doklady", ...[...PLANS.pro.features].map(featureLabel)],
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

/** Nadpis sekcie — malý štítok nad veľkým riadkom, rovnako v celom dokumente. */
function SectionHeading({
  label,
  title,
}: {
  label: string
  title: React.ReactNode
}) {
  return (
    <div className="mb-12 sm:mb-16">
      <p className="text-muted-foreground mb-4 text-sm tracking-wide uppercase">
        {label}
      </p>
      <h2 className="font-heading max-w-3xl text-[clamp(28px,5vw,52px)] leading-[1.1] tracking-tight">
        {title}
      </h2>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div>
      <HeroVideo />
      <LandingNav />
      <Hero />

      {/* Všetko pod hero prekrýva fixné video — odtiaľ vlastné pozadie a vrstva. */}
      <div className="bg-background relative z-1">
        <section className="mx-auto max-w-5xl px-5 py-24 sm:px-8 sm:py-32">
          <p className="font-heading max-w-3xl text-[clamp(26px,4.5vw,46px)] leading-[1.15] tracking-tight">
            Naháňaš faktúry, prepisuješ bločky a bojíš sa chýb v DPH? Nechaj to
            na nás a venuj sa tomu, čo ťa živí.
          </p>
        </section>

        <section
          id="funkcie"
          className="mx-auto max-w-5xl border-t px-5 py-24 sm:px-8 sm:py-32"
        >
          <SectionHeading
            label="Čo to vie"
            title="Tri veci, ktoré ti zoberú administratívu z krku."
          />
          <div className="grid gap-px">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="grid gap-4 border-t py-10 sm:grid-cols-[auto_1fr] sm:gap-12"
              >
                <span className="text-muted-foreground font-mono text-sm">
                  {f.n}
                </span>
                <div className="max-w-2xl">
                  <h3 className="font-heading mb-3 text-[clamp(20px,3vw,30px)] leading-tight tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {f.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          id="cennik"
          className="mx-auto max-w-5xl border-t px-5 py-24 sm:px-8 sm:py-32"
        >
          <SectionHeading
            label="Cenník"
            title="Začni zadarmo. Plať, až keď ti to začne šetriť čas."
          />
          <p className="text-muted-foreground mb-12 max-w-2xl text-base">
            Pro si vyskúšaš 14 dní zdarma, potom {planPrice("pro")} mesačne. Bez
            viazanosti, zrušíš kedykoľvek.
          </p>

          <div className="grid border-t sm:grid-cols-3">
            {PLAN_ORDER.map((tier) => {
              const plan = PLANS[tier]
              const highlight = tier === "pro"
              return (
                <div
                  key={tier}
                  className="flex flex-col gap-6 border-b px-0 py-10 sm:border-b-0 sm:px-8 sm:not-first:border-l sm:first:pl-0 sm:last:pr-0"
                >
                  <div>
                    <div className="mb-3 flex items-baseline gap-3">
                      <h3 className="font-heading text-xl tracking-tight">
                        {plan.label}
                      </h3>
                      {highlight && (
                        <span className="rounded-full border px-2.5 py-0.5 text-xs">
                          Obľúbené
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading text-[40px] leading-none tracking-tight">
                        {planPrice(tier)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {plan.priceEur ? "/ mesiac" : "navždy"}
                      </span>
                    </div>
                  </div>

                  <ul className="grid flex-1 content-start gap-2.5 text-sm">
                    {PLAN_HIGHLIGHTS[tier].map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    size="lg"
                    variant={highlight ? "default" : "outline"}
                    className="w-full"
                  >
                    <Link href="/register">
                      {tier === "free"
                        ? "Začať zadarmo"
                        : `Vyskúšať ${plan.label}`}
                    </Link>
                  </Button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="mx-auto max-w-5xl border-t px-5 py-24 sm:px-8 sm:py-32">
          <SectionHeading label="Porovnanie" title="Čo je v ktorom pláne." />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-4 text-left font-medium">Funkcia</th>
                  {PLAN_ORDER.map((t) => (
                    <th key={t} className="px-3 py-4 text-center font-medium">
                      {PLANS[t].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-4">Doklady / mesiac</td>
                  {PLAN_ORDER.map((t) => (
                    <td key={t} className="px-3 py-4 text-center tabular-nums">
                      {PLANS[t].docsPerMonth === null
                        ? "∞"
                        : PLANS[t].docsPerMonth}
                    </td>
                  ))}
                </tr>
                {ALL_FEATURES.map((f) => (
                  <tr key={f} className="border-b">
                    <td className="py-4">{featureLabel(f)}</td>
                    {PLAN_ORDER.map((t) => (
                      <td key={t} className="px-3 py-4 text-center">
                        {PLANS[t].features.has(f) ? (
                          <Check className="mx-auto size-4" />
                        ) : (
                          <Minus className="text-muted-foreground/40 mx-auto size-4" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-t">
          <div className="mx-auto max-w-5xl px-5 py-24 sm:px-8 sm:py-32">
            <SectionHeading
              label="e-Faktúra 2027"
              title="Od 1. januára 2027 to už nebude dobrovoľné."
            />
            <p className="text-muted-foreground mb-8 max-w-2xl text-base leading-relaxed">
              Si platiteľ DPH? Faktúry budeš musieť posielať elektronicky cez
              Peppol. So Synapse Faktúrou to máš vyriešené už dnes — žiadny
              zmätok na poslednú chvíľu.
            </p>
            <Button asChild size="lg" variant="outline">
              <Link href="/e-faktura-2027">Zisti, čo ťa čaká</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-5xl border-t px-5 py-24 sm:px-8 sm:py-32">
          <SectionHeading label="Otázky" title="Časté otázky." />
          <div className="border-t">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b py-5">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium">
                  {item.q}
                  <span className="text-muted-foreground shrink-0 text-xl transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-start gap-3">
            <h3 className="font-heading text-[clamp(24px,4vw,40px)] leading-tight tracking-tight">
              Hotové za dve minúty.
            </h3>
            <Button asChild size="lg">
              <Link href="/register">Vytvoriť účet zadarmo</Link>
            </Button>
            <p className="text-muted-foreground text-xs">
              Bez platobnej karty · Pro na 14 dní zdarma · Zruš kedykoľvek
            </p>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  )
}
