import type { Metadata } from "next"
import { LegalShell } from "@/components/legal/legal-shell"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Kontakt — Synapse Faktúra",
  description: "Kontaktné a fakturačné údaje prevádzkovateľa Synapse Faktúra.",
}

export default function ContactPage() {
  const c = SITE.company
  return (
    <LegalShell title="Kontakt">
      <section>
        <h2>Podpora</h2>
        <p>
          Napíšte nám na{" "}
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
          Odpovedáme spravidla do 1–2 pracovných dní.
        </p>
      </section>

      <section>
        <h2>Prevádzkovateľ</h2>
        <ul>
          <li>{c.legalName}</li>
          <li>IČO: {c.ico}</li>
          <li>DIČ: {c.dic}</li>
          <li>Sídlo: {c.address}</li>
          <li>{c.registration}</li>
        </ul>
      </section>
    </LegalShell>
  )
}
