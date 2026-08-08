import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "E-faktúra 2027 na Slovensku — čo to znamená a ako sa pripraviť",
  description:
    "Od 1. 1. 2027 bude e-faktúra povinná pre platiteľov DPH (Peppol / IS EFA, UBL 2.1). Prehľad termínov, modelu, pokút a ako sa pripraviť.",
  alternates: { canonical: "/e-faktura-2027" },
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-3">
      <h2 className="font-heading text-[clamp(19px,2.5vw,26px)] leading-tight tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function EFaktura2027Page() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        {/* Rovnaký podpis značky ako v navigácii úvodnej stránky. */}
        <Link href="/" className="flex items-center gap-3">
          <span className="font-heading text-lg tracking-tight">
            Synapse Faktúra
          </span>
          <span aria-hidden="true" className="text-xl select-none">
            ✳︎
          </span>
        </Link>
        <Button asChild>
          <Link href="/register">Začať zadarmo</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-heading text-[clamp(28px,4.5vw,48px)] leading-[1.1] tracking-tight">
          E-faktúra 2027 na Slovensku: čo to znamená a ako sa pripraviť
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Od 1. januára 2027 sa elektronická fakturácia stáva povinnou pre
          platiteľov DPH. Tu je prehľad, čo vás čaká a ako to zvládnuť bez stresu.
        </p>

        <div className="mt-10 grid gap-8 text-sm leading-relaxed">
          <Section title="Čo je e-faktúra 2027?">
            <p>
              Ide o povinné vystavovanie a výmenu faktúr v štruktúrovanom
              elektronickom formáte (nie PDF ani papier) cez sieť{" "}
              <strong>Peppol</strong> s reportovaním do informačného systému{" "}
              <strong>IS EFA</strong> Finančnej správy SR. Zmenu zavádza novela
              zákona č. 222/2004 Z. z. o DPH.
            </p>
          </Section>

          <Section title="Odkedy a koho sa týka">
            <ul className="grid gap-2">
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  <strong>Od 1. 1. 2027</strong> — povinnosť pre platiteľov DPH.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  Týka sa každého registrovaného platiteľa DPH bez ohľadu na
                  veľkosť firmy či obrat.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  Testovacie prostredie a zoznam certifikovaných „digitálnych
                  poštárov" sa očakávajú v priebehu roka 2026.
                </span>
              </li>
            </ul>
          </Section>

          <Section title="Ako to bude fungovať">
            <p>
              Slovensko zvolilo tzv. <strong>5-corner model</strong> nad štandardným
              Peppol modelom — pridáva Finančnú správu SR ako piaty prvok do výmeny.
              Faktúry sa posielajú v štruktúrovanom formáte{" "}
              <strong>UBL 2.1</strong> podľa európskej normy{" "}
              <strong>EN 16931</strong> (Peppol BIS Billing 3.0). Účastníci sa
              identifikujú Peppol ID; pre SK subjekty má tvar{" "}
              <code>0245:&lt;10-miestne DIČ&gt;</code>.
            </p>
          </Section>

          <Section title="Sankcie">
            <p>
              Za nevystavenie e-faktúry hrozia pokuty — podľa doterajších návrhov
              až do 10 000 €, pri opakovanom porušení výrazne viac. Presné sumy
              potvrdí finálne znenie predpisu.
            </p>
          </Section>

          <Section title="Ako sa pripraviť už teraz">
            <ul className="grid gap-2">
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  Používaj nástroj postavený na Peppol / EN 16931 od základu —
                  žiadne narýchlo prilepené riešenia.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>Maj poriadok v kontaktoch a DIČ/IČ DPH odberateľov.</span>
              </li>
              <li className="flex gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  Vyskúšaj si e-fakturáciu v predstihu — Synapse Faktúra už dnes
                  vie generovať aj prijímať e-faktúry.
                </span>
              </li>
            </ul>
          </Section>

          <div className="bg-muted/30 flex flex-col items-center gap-4 rounded-xl border p-8 text-center">
            <h2 className="font-heading text-[clamp(19px,2.5vw,26px)] tracking-tight">
              Priprav sa na 2027 už dnes
            </h2>
            <p className="text-muted-foreground">
              Začni zadarmo a maj e-faktúru vyriešenú skôr, než sa stane
              povinnosťou.
            </p>
            <Button asChild size="lg">
              <Link href="/register">Vytvoriť účet zadarmo</Link>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Informácie majú všeobecný charakter a nie sú daňovým poradenstvom.
            Konkrétne povinnosti si over v aktuálnom znení zákona č. 222/2004 Z. z.
            a na stránkach Finančnej správy SR.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
