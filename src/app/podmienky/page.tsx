import type { Metadata } from "next"
import { LegalShell, LegalDraftNotice } from "@/components/legal/legal-shell"
import { SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: "Obchodné podmienky — Synapse Faktúra",
  description: "Všeobecné obchodné podmienky používania služby Synapse Faktúra.",
}

export default function TermsPage() {
  const c = SITE.company
  return (
    <LegalShell title="Všeobecné obchodné podmienky">
      <LegalDraftNotice />

      <section>
        <h2>1. Prevádzkovateľ</h2>
        <p>
          Službu {SITE.name} prevádzkuje {c.legalName}, IČO {c.ico}, DIČ {c.dic},
          so sídlom {c.address}, {c.registration} (ďalej „poskytovateľ").
          Kontakt: {SITE.supportEmail}.
        </p>
      </section>

      <section>
        <h2>2. Predmet služby</h2>
        <p>
          {SITE.name} je online (SaaS) nástroj na vystavovanie a správu faktúr,
          evidenciu nákladov, upomienky a súvisiace ekonomické funkcie vrátane
          voliteľných AI funkcií a prípravy na e-faktúru (Peppol / EN 16931).
          Služba je poskytovaná „tak ako je" v aktuálnej verzii.
        </p>
      </section>

      <section>
        <h2>3. Registrácia a účet</h2>
        <ul>
          <li>Na používanie je potrebná registrácia a overenie e-mailu.</li>
          <li>Používateľ zodpovedá za správnosť údajov a bezpečnosť prihlásenia.</li>
          <li>Jeden účet môže spravovať viac firiem (organizácií) a členov.</li>
        </ul>
      </section>

      <section>
        <h2>4. Predplatné a platby</h2>
        <ul>
          <li>
            Služba má bezplatný plán (Free) a platené plány (Pro, Business) s
            mesačným predplatným. Aktuálne ceny sú uvedené v aplikácii.
          </li>
          <li>
            Platby spracúva poskytovateľ platobných služieb Stripe. Predplatné sa
            obnovuje automaticky, kým ho používateľ nezruší.
          </li>
          <li>
            Zrušiť predplatné je možné kedykoľvek; platí do konca zaplateného
            obdobia. K cene sa účtuje DPH podľa platných predpisov.
          </li>
          <li>
            Prípadná skúšobná doba (trial) je bezplatná; ak ju používateľ nezruší
            pred koncom, prechádza na platené predplatné.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Zodpovednosť za daňovú a účtovnú správnosť</h2>
        <p>
          Nástroj pomáha s výpočtom DPH a náležitosťami dokladov, no konečnú
          zodpovednosť za správnosť daňových a účtovných dokladov nesie
          používateľ. Poskytovateľ nezodpovedá za škody spôsobené nesprávnymi
          vstupnými údajmi ani za rozhodnutia urobené na základe AI výstupov, ktoré
          majú informatívny charakter.
        </p>
      </section>

      <section>
        <h2>6. Dostupnosť a obmedzenie zodpovednosti</h2>
        <p>
          Poskytovateľ sa snaží o vysokú dostupnosť, no negarantuje neprerušovanú
          prevádzku. Zodpovednosť za škodu je obmedzená do výšky predplatného
          zaplateného za posledných 12 mesiacov, v rozsahu povolenom právom.
        </p>
      </section>

      <section>
        <h2>7. Ukončenie</h2>
        <p>
          Používateľ môže účet kedykoľvek zrušiť. Poskytovateľ môže ukončiť
          poskytovanie pri porušení podmienok. Po zrušení sú údaje spracúvané podľa
          zásad ochrany osobných údajov.
        </p>
      </section>

      <section>
        <h2>8. Zmeny podmienok</h2>
        <p>
          Podmienky môžu byť aktualizované; o podstatných zmenách poskytovateľ
          informuje vopred. Pokračovaním v používaní používateľ vyjadruje súhlas.
        </p>
      </section>

      <section>
        <h2>9. Rozhodné právo</h2>
        <p>
          Vzťah sa riadi právom Slovenskej republiky. Spory sa prednostne riešia
          dohodou; inak sú príslušné súdy SR.
        </p>
      </section>
    </LegalShell>
  )
}
