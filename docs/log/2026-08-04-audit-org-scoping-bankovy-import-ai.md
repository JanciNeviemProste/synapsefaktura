# 2026-08-04: Audit — org scoping, bankový import, AI gating a náklady

Externý audit proti štruktúre SuperFaktúry našiel tri triedy problémov. Fáza 0
= opravy, nie nové funkcie. Ďalej nasleduje parita (typy dokladov, chýbajúce
moduly, kniha jázd) a až potom AI ako odlišovač.

- **Fáza 0 hotová (PR #1, `2981cfe`):**
  - **Únik dát medzi organizáciami** — 9 čítacích ciest ignorovalo
    `getCurrentOrgId` a spoliehalo sa na RLS, ktorá pustí _všetky_ organizácie
    používateľa. Kto bol v dvoch firmách, videl zmiešané dáta; export pre
    účtovníka bral organizáciu cez `limit(1)`. Doplnený filter všade.
  - **Bankový import** — knihoval platbu aj pri zhode samotného VS s nesediacou
    sumou (preplatok pretlačil `paid_amount` nad `total`); pridaná detekcia
    duplicít podľa `(dátum, suma, VS, protistrana)`.
  - **AI tarifné diery** — `anomaly` bola Pro funkcia dostupná zadarmo (nevolá
    AI, teda nikdy neprešla cez gate); `forecast` bol Business-only len naoko;
    cron obchádzal gate aj účtovanie (`orgId` null → `ok:true`). Gate je teraz
    fail-closed a `orgId` sa do cronu posiela z načítaného dokladu.
  - **Náklady** — `ai_usage` sa zapisovalo, ale nikdy nečítalo; pridaný mesačný
    strop (`lib/ai/budget.ts`, čistá funkcia + testy).
  - **Chyby** — párovanie kontaktu cez `needle.includes(hay)` spájalo kontakt
    menom „a" s ľubovoľnou vetou (`lib/contacts/match-name.ts` + testy); prompt
    nedostával údaje firmy, takže neplatiteľ DPH dostal 23 %; `summarize_client`
    ticho bral prvý výsledok; chyby AI sa prehĺtali v prázdnom `catch`.
  - **Texty** — landing page sľubovala veci, ktoré kód nerobí; zosúladené.
    ADR: poskytovateľ je Gemini, nie Claude, ako tvrdí master prompt.
- **Fáza 0 doplnky (táto vetva):**
  - **Rate limit na AI** — `checkRateLimit` bol len na checkout a pozvánky;
    `lib/ai/rate-limit.ts` ho pridáva na interaktívne AI akcie
    (`aiCallsPerMinute` per plán). Zámerne NIE v `generate.ts` — cron legitímne
    generuje desiatky upomienok v jednom behu.
  - **`degraded` vs `gated`** — obidva prípady vracali `degraded: true`, takže
    Free používateľ na paywalle dostal hlášku „chýba kľúč" namiesto ponuky
    upgradu. Pribudol `AiFailureReason`; tri AI komponenty teraz používajú
    `useUpgrade()` rovnako ako zvyšok appky. Akcie prestali zahadzovať `upgrade`.
  - **`next lint` → `eslint .`** — `next lint` je deprecated a v Next 16 mizne.
  - Pri tom: `ai-capture` volal model _pred_ zistením organizácie, takže spálil
    token aj keď používateľ firmu nemal.
