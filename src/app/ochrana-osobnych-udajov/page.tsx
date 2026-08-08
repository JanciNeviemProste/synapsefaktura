import type { Metadata } from "next"
import { LegalShell, LegalDraftNotice } from "@/components/legal/legal-shell"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Ochrana osobných údajov — Synapse Faktúra",
  description:
    "Zásady spracúvania osobných údajov (GDPR) v službe Synapse Faktúra.",
}

export default function PrivacyPage() {
  const c = SITE.company
  return (
    <LegalShell title="Ochrana osobných údajov (GDPR)">
      <LegalDraftNotice />

      <section>
        <h2>1. Prevádzkovateľ</h2>
        <p>
          Prevádzkovateľom je {c.legalName}, IČO {c.ico}, so sídlom {c.address}.
          Kontakt vo veciach ochrany údajov: {SITE.supportEmail}.
        </p>
      </section>

      <section>
        <h2>2. Aké údaje spracúvame</h2>
        <ul>
          <li>
            Registračné údaje: meno, e-mail, heslo (v zašifrovanej podobe).
          </li>
          <li>
            Firemné a fakturačné údaje: názov firmy, IČO/DIČ/IČ DPH, adresa,
            banka.
          </li>
          <li>
            Obsah dokladov, kontaktov, nákladov a súvisiacich záznamov, ktoré
            zadáte.
          </li>
          <li>
            Platobné údaje spracúva Stripe; my nevidíme čísla platobných kariet.
          </li>
          <li>
            Technické údaje: prihlásenia, logy pre bezpečnosť a prevádzku.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Účel a právny základ</h2>
        <ul>
          <li>
            Poskytovanie služby a plnenie zmluvy (čl. 6 ods. 1 písm. b GDPR).
          </li>
          <li>
            Plnenie zákonných povinností — účtovníctvo, dane (čl. 6 ods. 1 písm.
            c).
          </li>
          <li>
            Oprávnený záujem — bezpečnosť, prevencia zneužitia (čl. 6 ods. 1
            písm. f).
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Sprostredkovatelia</h2>
        <p>Údaje v nevyhnutnom rozsahu spracúvajú títo poskytovatelia:</p>
        <ul>
          {SITE.processors.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> — {p.purpose} ({p.region}).
            </li>
          ))}
        </ul>
        <p>
          Pri prenose mimo EÚ sa uplatňujú štandardné zmluvné doložky, resp. iné
          primerané záruky podľa GDPR.
        </p>
      </section>

      <section>
        <h2>5. Doba uchovávania</h2>
        <p>
          Údaje uchovávame počas trvania účtu a následne po dobu vyžadovanú
          zákonom (najmä účtovné a daňové doklady — spravidla 10 rokov). Po
          zrušení účtu ostatné údaje vymažeme alebo anonymizujeme.
        </p>
      </section>

      <section>
        <h2>6. Vaše práva</h2>
        <ul>
          <li>Prístup k údajom, ich oprava a výmaz.</li>
          <li>Obmedzenie spracúvania a prenositeľnosť údajov.</li>
          <li>Namietať spracúvanie na základe oprávneného záujmu.</li>
          <li>
            Podať sťažnosť na Úrad na ochranu osobných údajov SR
            (dataprotection.gov.sk).
          </li>
        </ul>
        <p>Žiadosti posielajte na {SITE.supportEmail}.</p>
      </section>

      <section>
        <h2>7. Zabezpečenie</h2>
        <p>
          Uplatňujeme technické a organizačné opatrenia: izolácia dát medzi
          firmami (row-level security), šifrovaný prenos, obmedzenie prístupu a
          ochranu pred zneužitím.
        </p>
      </section>
    </LegalShell>
  )
}
