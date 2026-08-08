import type { Metadata } from "next"
import { LegalShell } from "@/components/legal/legal-shell"

export const metadata: Metadata = {
  title: "Cookies — Synapse Faktúra",
  description: "Zásady používania súborov cookie v službe Synapse Faktúra.",
}

export default function CookiesPage() {
  return (
    <LegalShell title="Zásady používania cookies">
      <section>
        <h2>Aké cookies používame</h2>
        <p>
          Používame výhradne <strong>nevyhnutné (funkčné)</strong> súbory
          cookie, ktoré sú potrebné na fungovanie služby. Nepoužívame reklamné
          ani sledovacie cookies tretích strán na profilovanie.
        </p>
        <ul>
          <li>
            <strong>Prihlásenie (auth)</strong> — udržiava vašu reláciu po
            prihlásení.
          </li>
          <li>
            <strong>locale</strong> — zapamätá si zvolený jazyk rozhrania
            (SK/CZ/EN).
          </li>
          <li>
            <strong>theme</strong> — zapamätá si svetlý/tmavý režim.
          </li>
          <li>
            <strong>active org</strong> — zapamätá si naposledy zvolenú firmu.
          </li>
        </ul>
      </section>

      <section>
        <h2>Súhlas</h2>
        <p>
          Keďže ide o nevyhnutné cookies potrebné na poskytnutie služby, ktorú
          ste si vyžiadali, nevyžadujú predchádzajúci súhlas. Ak by sme v
          budúcnosti pridali analytické alebo marketingové cookies, vyžiadame si
          na ne súhlas.
        </p>
      </section>

      <section>
        <h2>Správa cookies</h2>
        <p>
          Cookies môžete kedykoľvek vymazať alebo blokovať v nastaveniach
          prehliadača. Blokovanie nevyhnutných cookies však znemožní prihlásenie
          a používanie služby.
        </p>
      </section>
    </LegalShell>
  )
}
