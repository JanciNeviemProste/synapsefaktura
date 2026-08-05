@AGENTS.md

# Synapse Faktúra — CLAUDE.md

> Zdroj pravdy pre prácu na projekte (šablóna podľa Master Prompt v2 §10).
> Master prompt = PROCES, tento súbor = KONTEXT. Aktualizuj PO KAŽDEJ fáze.

## Stack & príkazy

- **Next.js 15** (App Router, Server Components, Server Actions) · **React 19** ·
  **TypeScript** strict · **Tailwind v4** + **shadcn/ui** (Base UI variant) +
  lucide-react · **Supabase** (Postgres, Auth, RLS) · **pnpm**.
- AI: `@ai-sdk/google` (Gemini). Billing: `stripe`. E-faktúra: vlastný UBL 2.1.
  i18n: `next-intl` (cookie, bez routingu). PDF: `@react-pdf/renderer`. QR:
  `bysquare` + `qrcode`.

| Príkaz | Popis |
| --- | --- |
| `pnpm dev` | Dev server (`next dev`) |
| `pnpm build` | Produkčný build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint CLI (`eslint .`, flat config) |
| `pnpm test` | `vitest run` |
| `pnpm format` | Prettier (zápis) |
| `pnpm db:start` / `db:stop` | Lokálny Supabase (Docker) |
| `pnpm db:reset` | Reaplikuje migrácie + seed |
| `pnpm db:migrate` | Aplikuje nové migrácie |

**Brána pred commitom na main:** `typecheck` + `lint` + `test` + `build` = všetko PASS.

## Architektúra

Multi-tenant SaaS: každá tabuľka je org-scoped cez `organization_members` + RLS.
UI je Server Components + Server Actions (`src/app/actions/*`); mutácie validuje
zod, autorizuje `getCurrentOrgId`/RLS. Externé služby (AI, Stripe, Peppol, Email,
Redis) bežia v **graceful-degradation** vzore — bez kľúča appka beží, daná funkcia
je vypnutá (`hasAiKey`, `hasStripe`, `hasEmail`, `supabaseEnv().configured`).

Kľúčové adresáre:
- `src/app/app/(shell)/**` — chránená oblasť (dashboard, invoices, contacts,
  products, expenses, bank, recurring, reports, einvoices, assistant, settings).
- `src/app/actions/**` — Server Actions (documents, contacts, products, expenses,
  payments, recurring, reminders, billing, members, org, einvoice*, ai-*).
- `src/app/api/**` — route handlers: `cron/{overdue,recurring,reminders,peppol}`,
  `stripe/webhook`.
- `src/lib/**` — doménová logika: `vat/`, `money.ts`, `documents/`, `pdf/`, `qr/`,
  `peppol/`, `ai/`, `billing/`, `email/`, `security/`, `supabase/`, `registry/`,
  `jobs/`, `reports/`, `matching/`, `forecast/`, `anomaly/`, `reminders/`, `bank/`.
- `supabase/migrations/**` — SQL migrácie (RLS na každej dátovej tabuľke).
- `messages/{sk,cz,en}.json` — i18n; `src/i18n/request.ts` (SK fallback).

## Env vars (názvy — NIKDY hodnoty; žijú v `.env.local` / Vercel env)

Povinné: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Odporúčané: `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
Voliteľné (feature sa aktivuje kľúčom): `OPENROUTER_API_KEY` (má prednosť; modely
`vendor/model`, default `google/gemini-2.5-flash`), `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_MODEL`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`,
`STRIPE_PRICE_BUSINESS`, `RESEND_API_KEY`, `EMAIL_FROM`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`.

## NEDOTÝKAŤ SA (funkčné + testované — meniť len s testom a dôvodom)

- `src/lib/vat/engine.ts` — DPH výpočty (testované `vat/engine.test.ts`).
- `src/lib/money.ts` — peňažná matematika/zaokrúhľovanie (testované).
- `supabase/migrations/**` RLS policies + `20260625140000_member_role_guard.sql`
  (chráni owner-a pred povýšením/degradáciou).
- `src/lib/peppol/{ubl,validate,inbound}.ts` — UBL 2.1 generovanie/validácia
  (testované); štruktúru nemeniť, len anotovať kódy pri legislatívnom overení.
- `src/lib/supabase/{middleware,env}.ts` — fail-open Edge guard (rieši Vercel
  `MIDDLEWARE_INVOCATION_FAILED`).

## Známe problémy / TODO (živý zoznam)

- **SK legislatíva — čiastočne overená (Fáza E, 2026-07-05).** FAKT: Peppol
  `0245`=DIČ, DPH 23/19/5 % od 1.1.2025, UNCL5305 kategórie, UN/ECE Rec 20
  jednotky, §69/čl. 138 poznámky (viď `docs/DECISIONS.md`). **OTVORENÉ:** FS SR
  KV/SV XSD (`export/fs-sr.ts` — schéma nie je verejná), neplatiteľ→`O` (potvrdiť
  voči IS EFA), RPO/VIES endpoint tvar (`registry/*`).
- **Peppol provider = mock** — `peppol/provider/mock.ts` (loopback). Reálny
  certifikovaný Digitálny poštár za `DigitalPostmanProvider` interface — čaká na
  externú akreditáciu.
- **Billing tiery** — `billing/plans.ts` ceny/limity `TODO: confirm` (biznis rozhodnutie).
  Týka sa aj AI stropov: `aiMonthlyCostLimit` (mesačný náklad, odhad v USD podľa
  `ai/cost.ts`) a `aiCallsPerMinute` (nárazový limit interaktívnych volaní).
- **Externé kľúče chýbajú** — AI/Stripe/Email/Upstash bežia graceful bez kľúča;
  produkcia potrebuje hosted Supabase + Vercel env.

## Stav (posledné 📊 — 2026-08-05)

`main`: `typecheck` PASS · `lint` PASS · `test` **421/421** PASS · `build` PASS.
**20 migrácií** sa aplikuje načisto na PostgreSQL 17 — 36 tabuliek, 26 enumov,
81 policies, 10 funkcií, 0 tabuliek bez RLS. To isté overuje CI job `migrations`.

Nasadené na `synapsefaktura.vercel.app`. Supabase `oukooqfpxeunhdzndsid` je
`ACTIVE_HEALTHY`; evidencia migrácií sedí s repom 1:1. Keep-alive workflow beží
(HTTP 200). ⚠️ **Posledné dve migrácie (`20260805150000`, branding nepotrebuje
migráciu) ešte nie sú nasadené na produkciu** — nasadiť po merge, so zálohou
`pg_dump` predtým.
Verejné stránky bežia aj bez databázy. Blokátory: Stripe/e-mail/analytics kľúče,
firemné údaje, neoverená SK legislatíva.

## Session log

### 2026-08-05: Zákonné sadzby z overeného zdroja + branding firmy

**Cestovné náhrady.** Sadzba sa v minulom kole zámerne neseedovala; teraz je
overená **priamo v Zbierke zákonov** (`static.slov-lex.sk`), nie z druhej ruky:

| od | osobné | jednostopové | predpis |
|---|---|---|---|
| 1. 5. 2024 | 0,265 | 0,075 | opatrenie 73/2024 Z. z. |
| 1. 3. 2025 | 0,281 | 0,080 | oznámenie 22/2025 Z. z. |
| 1. 6. 2025 | 0,296 | 0,085 | oznámenie 97/2025 Z. z. |
| 1. 1. 2026 | **0,313** | **0,090** | oznámenie 340/2025 Z. z. |

Aktuálna sadzba potvrdená tromi oficiálnymi zdrojmi. Každý riadok nesie
`source_ref` + `source_url` — pri kontrole je to prvé, na čo sa pýtajú.

- **Kategória vozidla** (`vehicles.category`) je nutná, nie kozmetická: zákon
  má pre motocykel 0,090 oproti 0,313, teda 3,5-násobný rozdiel.
  `resolveTravelRate` vyberá podľa kategórie **aj** dátumu jazdy a sadzbu inej
  kategórie radšej nepoužije, než by dala násobok zákonného stropu.
- **Zmena sa zisťuje, nie vykonáva.** Mesačný cron číta stránku MPSVR; nájdená
  sadzba sa zapíše **nepotvrdená** a `resolveTravelRate` ju ignoruje. Potvrdí
  sa jedným klikom v Nastaveniach. Daňové číslo sa nemá zmeniť samo.
- **Parser overený proti reálnej stránke — a dobre že tak.** Prvá verzia
  vracala `97/2025` namiesto `340/2025` a 0,085 namiesto 0,090: vyzerala
  správne a bola zlá. Stránka totiž uvádza ZMENU („z 0,085 na 0,090"), spomína
  štyri čísla predpisov, u nového má odseknutú koncovku („č. 340/2025 Z.")
  a staršiu účinnosť uvádza skôr než novú. Fixture v testoch si všetky štyri
  pasce drží.
- Poistky, pri ktorých sa nič nezapíše: suma mimo 0,01–2,00 €/km, osobné
  vozidlo nemá vyššiu sadzbu než jednostopové, sadzba je **nižšia** než súčasná
  (zákon ju len zvyšuje → nižšia = chyba parsovania), chýba číslo oznámenia
  alebo dátum účinnosti.

**Branding.** `logo_url`, `signature_url`, `stamp_url` existovali od prvej
migrácie a PDF ich vedelo vykresliť, ale **nikto ich nezapisoval** — dashboard
pritom posielal používateľa doplniť logo do nastavení, kde pole nebolo.

- Všetky tri idú do **súkromného** úložiska (`{orgId}/branding/…`). Verejná
  adresa obrázku podpisu je návod na falšovanie. PDF si súbor sťahuje
  service-role klientom priamo pri generovaní, náhľad v Nastaveniach ide cez
  podpísanú adresu platnú 10 minút.
- **Validácia sa presunula na upload** (`lib/images/validate.ts`) a používajú ju
  obe strany. Dovtedy sa PNG/JPEG a 2 MB kontrolovali až pri renderi, takže
  používateľ nahral 5 MB WebP, dostal „nahraté" a logo mu na faktúre nikdy
  nevyšlo — bez vysvetlenia.
- Upload má rolový guard owner/admin a pri výmene maže starý súbor.

**Pri tom opravené:** `updateOrganization` bez `.select()` overenia — PostgREST
pri zápise odfiltrovanom RLS vráti 204 bez chyby.

**Otvorené:** príplatok +15 % pri použití prívesu (`trips` nemá príznak prívesu)
a automatické zálohovanie (Roman: zatiaľ ručné, v DB nie sú ostré dáta).

### 2026-08-05: Dostavba — 11 položiek „zavedené, ale nikde nepoužité"
Roman: „všetko aplikuj". Zo ~1 500 riadkov mŕtvej schémy a kódu je funkčný
produkt. Poradie podľa toho, čo najviac bolí, nie podľa modulov.

- **Dobropisy vo výkazoch** — dashboard, reporty aj exporty si filtrovali
  `type = 'invoice'` každý sám, takže doklad, ktorého jediným zmyslom je
  znižovať základ dane, sa do výkazu vôbec nedostal. Zoznam typov je teraz na
  jednom mieste (`documents/reporting.ts`). `tax_doc_payment` **zámerne
  zostáva vonku** a test to stráži: bez odpočtu zálohy by sa tá istá tržba
  vykázala dvakrát a nadhodnotená DPH je horšia chyba než chýbajúci riadok.
- **Kontrola knihy jázd** — `LogbookSummary` sa nikde neimportoval. Pri
  zapojení vysvitlo, že karta uznateľného paliva sčítavala všetky jazdy od
  začiatku, kým audit pod ňou hlásil nálezy len za obdobie. Stránka má teraz
  jedno spoločné obdobie.
- **Štítky** — `TagPicker` a štyri akcie boli mŕtve, hoci nastavenia sľubovali
  označovanie aj filtrovanie. Výber na detaile dokladu a v riadkoch nákladov
  a klientov, filter nad každým zoznamom. `taggedEntityIds` rozlišuje `null`
  (bez filtra) od `[]` (nič nevyhovuje) — inak by podvrhnutý `?tag=` z cudzej
  firmy ticho vypísal celý zoznam.
- **Prepínače tlače** — `show_prices`, `show_qr_payment` a `show_signature`
  boli `not null default true`, takže sa nedali zapojiť: každý existujúci
  doklad ich mal `true` vrátane dodacích listov. Migrácia ich robí nullable
  (`null` = podľa typu) a hodnoty nuluje — bezpečné práve preto, že ich nikdy
  nikto nečítal. QR sa orezáva na `showPrices && isPayable`.
- **`send_method`** — odosielanie bolo napísané, ale nikto ho nevedel
  nastaviť, takže bolo vždy `none`. Default zostáva `none`: zapnuté
  odosielanie pošle doklad odberateľovi bez toho, aby ho niekto videl.
- **Cestovné náhrady** — `resolveTravelRate` berie sadzbu platnú **k dátumu
  jazdy**, vlastná sadzba firmy má prednosť pred zákonnou. **Žiadna sadzba sa
  neseeduje** — je to zákonné číslo meniace sa v čase a dosadiť ho bez
  overenia by znamenalo tváriť sa, že appka pozná, čo jej nikto nezadal.
- **Pravidelné jazdy** — rozvrh počíta `planRecurringRuns`, tá istá funkcia
  ako pri faktúrach. Generovanie spúšťa používateľ, nie cron: kniha jázd je
  daňový podklad. Tachometer sa nedopĺňa.
- **Položky nákladov** — dodávateľská faktúra s 23 % aj 19 % sa nedala zadať
  správne. `computeExpenseItems` používa `computeInvoice`, ten istý otestovaný
  VAT engine. Rozpis je voliteľný — AI OCR a e-faktúra posielajú jednu sumu
  a fungujú ďalej.
- **Úhrady nákladov** — `paid_amount` je odteraz **súčtom** riadkov
  v `expense_payments`, nie inkrementovaným číslom. Dvojklik ho nenafúkne;
  bankový import posiela `bank_transaction_id` a unikátny index
  `(expense_id, bank_transaction_id)` drží idempotenciu aj proti súbežným
  behom. Migrácia prenesie existujúce sumy ako jeden riadok s poznámkou, že
  rozpis neexistuje.
- **Číselné rady pokladne** — súvislý rad je pri pokladničnej knihe zákonná
  požiadavka. Nový `next_sequence_number(id, year)` adresuje rad cez id (RPC
  pre doklady adresuje cez org+typ+rok). **Unikátne obmedzenie
  `(organization_id, doc_type, year)` sa NEDOTKLO** — na ňom stojí `on
  conflict` v `next_document_number`; `doc_type` je len nullable a NULL hodnoty
  doň nespadnú. Overené proti reálnemu Postgresu: faktúry číslujú presne ako
  predtým, pokladňa má vlastný rad a cez Nový rok sa resetuje.
- **Účtovné členenie** — účet/stredisko/zákazka/činnosť sa zadávajú na doklade
  a zapisujú na všetky položky; nový položkový export `accounting-items-csv`
  ich číta. Rozlíšenie po položkách schéma unesie, UI ho zatiaľ neponúka.

**Pri tom opravené (tá istá trieda chýb, akú sme riešili vo Fáze 0):** detail
dokladu sa načítaval bez filtra na organizáciu a `organizations` cez `limit(1)`;
`number_sequences` v nastaveniach tiež bez filtra; `updateExpense` bez
`.select()` overenia; „Zrušiť úhrady" bolo nevratné na jeden klik bez potvrdenia.

**Dôkaz, že kód bol naozaj mŕtvy:** `logbook-summary.ts` má `"use server"`
a exportoval zod schému, čo Next zakazuje (Server Action smie exportovať len
async funkcie). Build to nikdy nenahlásil, lebo sa súbor do buildu nedostal —
spadol až pri zapojení komponentu.

### 2026-08-05: Evidencia migrácií zosúladená s repom + CI poistka
Desať migrácií malo v `supabase_migrations.schema_migrations` zapísanú **inú
`version`, než mal súbor v repe** — MCP `apply_migration` si píše vlastnú
časovú pečiatku. `supabase db push` porovnáva verzie, nie názvy, takže by ich
videl ako nenasadené a pustil znova.
- **Skorší predpoklad („idempotencia to pokryje") bol nesprávny.** Overené:
  **šesť z desiatich by spadlo** — `foundation`, `invoicing`, `money_ops`,
  `ai_layer`, `einvoices`, `billing_members` majú `create table` bez
  `if not exists` a nestrážený `create type`. Bezpečné sú len tie štyri novšie
  (`numbering_system`, `member_role_guard`, `missing_modules`, `logbook`),
  písané už s guardmi.
- **Oprava:** jeden `update` v transakcii prepísal `version` na tú zo súboru;
  párovanie cez stĺpec `name`, ktorý sedel presne. Schéma sa nedotkla —
  zmenil sa len štítok už vykonanej migrácie. Kontrola *vnútri* transakcie
  (`raise exception` → rollback) vyžadovala, aby po prepise sedelo všetkých 15
  záznamov a nezostal ani jeden bez súboru.
  Skript: `superfaktura-research/scripts/prod-fix-migration-versions.mjs`
  (bez `--apply` len náhľad), záloha `backups/schema_migrations-*.sql`.
- **Overené po zásahu:** 15/15 migrácií sedí s repom, 0 duplicít; počty
  nezmenené (36 tabuliek / 25 enumov / 81 policies / 9 funkcií);
  `save_document_with_items` stále zavretá; `/` `/login` 200, `/app/dashboard` 307.
- **Aby sa to nezopakovalo — nový CI job `migrations`:** postaví databázu od
  nuly zo súborov v repe (`postgres:17` service + `supabase/ci/pg-stub.sql`,
  bez Dockeru a Supabase CLI) a spadne, ak niektorá migrácia neprejde alebo
  ak nejaká `public` tabuľka nemá RLS. Navyše stráži jednoznačnosť názvov
  súborov — práve `name` bol jediné, čo túto opravu umožnilo.

### 2026-08-04: Audit — org scoping, bankový import, AI gating a náklady
Externý audit proti štruktúre SuperFaktúry našiel tri triedy problémov. Fáza 0
= opravy, nie nové funkcie. Ďalej nasleduje parita (typy dokladov, chýbajúce
moduly, kniha jázd) a až potom AI ako odlišovač.

- **Fáza 0 hotová (PR #1, `2981cfe`):**
  - **Únik dát medzi organizáciami** — 9 čítacích ciest ignorovalo
    `getCurrentOrgId` a spoliehalo sa na RLS, ktorá pustí *všetky* organizácie
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
  - Pri tom: `ai-capture` volal model *pred* zistením organizácie, takže spálil
    token aj keď používateľ firmu nemal.

### 2026-08-04: Recenzia fáz 1–6 a opravy (PR #10)
Sedem naskladaných PR (#3–#9) prešlo recenziou. Nálezy overené v kóde, nie
prevzaté; adversárne preverenie dva z nich spresnilo.
- **Bezpečnosť:** `save_document_with_items` je `security definer` a zoznam
  stĺpcov berie z klientovho JSON. `EXECUTE` mal `PUBLIC`, takže ktokoľvek
  prihlásený mohol cez RPC nastaviť `total`, `paid_amount` či `status` priamo,
  s obídením prepočtu v `saveDocument`. Právo odobraté (`20260805090000`),
  volá sa service-role klientom.
- **Daňový podklad:** detail vozidla podával služobné km spolu s *celým*
  nakúpeným palivom → uznateľné palivo nadhodnotené takmer o 100 % (60 l
  namiesto 35 l na kontrolnom príklade). Nová čistá funkcia
  `deductibleBusinessFuel`: najprv `min(normovaná za všetky km, nakúpené)`,
  až potom služobný podiel.
- **Peniaze:** výsledok `recordPayment` sa zahadzoval → transakcia sa označila
  `matched`, platba v DB nebola a dedup ju pri ďalšom importe preskočil.
  Odchodzie platby sa knihovali aj bez VS (mzdy a paušály so zhodnou sumou).
- **Cudzí IBAN:** `renderInvoicePdf` nefiltroval doklad na organizáciu.
- **Cross-org zápis:** `updateProduct`/`deleteProduct` bez org filtra.
- **Falošný úspech mazania:** `for delete using (has_org_role(...))` + kontrola
  len `error` → PostgREST vráti 204 bez chyby. Nový `writeOutcome`.
- Dobropis dostal záporné znamienko; `stock_qty` má jedného zapisovateľa;
  bankové účty rolový guard; `parseType` cez `Object.hasOwn`.
- **Overené:** 356/356 testov, 15 migrácií načisto, všetkých 7 medzistavov
  stacku lokálne zelené (CI ich nikdy nespustilo).
- **Otvorené (rozhodnutie o rozsahu, nie chyba):** ~1 500 riadkov zavedenej,
  ale nepoužitej schémy a kódu — `LogbookSummary`, `TagPicker`,
  `expense_payments`, `travel_rates`, číselné rady pokladne, `send_method`.
  Dobropisy navyše nevstupujú do výkazov (`.eq("type","invoice")`).

### 2026-08-04: Externý prispievateľ — migrácie fáz 3 a 4 aplikované cez MCP
Roman (`csrom`, write prístup) otvoril 6 stacked PR (#2 → #3 → #4 → #5 → #6 → #7).
Žiadal `SUPABASE_DB_URL` ako repo secret, aby si vedel aplikovať migrácie sám.
- **Secret sa nedal a nedáva sa.** `postgres` rola obchádza RLS, repo je
  **verejné** a secret si vie ktokoľvek s write prístupom vypísať cez vlastný
  workflow (maskovanie v logoch sa obíde base64-om); odvolanie = reset hesla DB.
  Namiesto toho migrácie aplikuje vlastník cez Supabase MCP `apply_migration`.
- Aplikované: `missing_modules` (PR #6, 8 tabuliek + 3 enumy) a `logbook`
  (PR #7, 6 tabuliek + 4 enumy). **22 → 36 tabuliek, 16 → 23 enumov,
  34 → 81 policies, 0 tabuliek bez RLS.** Obe sú čisto aditívne a idempotentné;
  jediný zásah do existujúcej tabuľky = 4 nullable stĺpce na `document_items`.
- **Romanove ručne písané `database.types.ts` sedeli s generátorom na nulu** —
  jediný rozdiel v súbore je hlavička (`graphql_public` zo staršieho
  `supabase gen types` vs. `__InternalSupabase` z MCP), takže sa nemenil.
- ⚠️ **MCP zapíše vlastný `version` timestamp** (`20260804163839`,
  `20260804164240`), nie ten z názvu súboru → po merge pustí `supabase db push`
  `20260804180000/190000` znova. Idempotencia migrácií to pokryje.
- ⚠️ **CI na stacked PR nebeží** — `ci.yml` má `on: pull_request: branches:[main]`,
  čo filtruje podľa *base* vetvy; #3–#7 mieria na predošlé vetvy stacku. Bežia len
  GitGuardian + Vercel build. Overené lokálne na vrchole stacku: typecheck PASS,
  `eslint .` PASS, **324/324 testov**. Opravené na `main`: `pull_request` už
  nemá `branches` filter, takže checky bežia aj na stacked PR.
- Produkcia nedotknutá: `/` `/login` 200, `/app/dashboard` 307, runtime errors 0.
  Security advisors bez nového nálezu.
- **Schéma je pred kódom** — 14 prázdnych tabuliek, ktoré nasadený kód nepozná.
  Inertné; ak by PR neprešli, treba ich manuálne dropnúť.
- Otvorené: review a merge PR #2–#7 (poradie stacku je záväzné).

### 2026-07-05: Master Prompt v2 režim — TOP 5 hardening
Prijatý MP v2 rámec. Audit: fázy 0–5 zelené. Schválený plán na 5 fáz: A proces&docs,
B email doručovanie, C testy actions+RLS, D security+pentest, E SK legislatíva.
- **Fáza A hotová:** projektový CLAUDE.md (§10) + docs/DECISIONS.md + docs/SECURITY.md.
- **Fáza B hotová:** reálne e-mail doručovanie (Resend REST za `hasEmail()`),
  i18n templates (SK/CZ/EN), zdieľaný `pdf/render.tsx`, wire `markAsSent`
  (PDF príloha, `delivered` flag) + reminders (poctivý `sent_at`). +12 testov (110/110).
- **Fáza C hotová:** action-logic testy — `billing/gate.test.ts` (vrátane
  fail-closed vetiev: DB error → deny), `reminders/level.test.ts` (extrahovaný
  čistý `nextReminderLevel`). RLS pgTAP `supabase/tests/rls.sql` + `pnpm db:test`
  — NAPÍSANÉ, nespustené (Docker down) = PREDPOKLAD. +15 testov (125/125).
- **Fáza D hotová:** durable rate-limit (Upstash REST + in-memory fallback,
  `checkRateLimit`; migrovaní invite/checkout). §6A audit čistý (0 secrets v
  bundle, `.env*` ignorované, 0 `dangerouslySetInnerHTML`, `pnpm audit` 0
  high/critical — 1 moderate postcss<8.5.10 cez next). §6B skript
  `scripts/pentest.sh` (beh čaká na nasadené preview). +5 testov (130/130).
  Výsledky v `docs/SECURITY.md`.
- **Fáza E hotová:** SK legislatíva overená proti oficiálnym zdrojom — FAKT:
  Peppol 0245=DIČ, DPH 23/19/5 % od 2025, UNCL5305 kategórie, UN/ECE Rec 20,
  §69/čl. 138. OTVORENÉ (čestne označené): FS SR KV/SV XSD, neplatiteľ→O, RPO/VIES.
  Anotácie v kóde (FAKT + zdroj), tabuľka v `docs/DECISIONS.md`. Testy 130/130.
- **VŠETKÝCH 5 FÁZ HOTOVÝCH** (pushnuté 05b6150).

### 2026-07-05: Launch v1 — od kódu k prvému zákazníkovi
Nový plán (schválený): L1 právne minimum · L2 live deploy+Stripe · L3 konverzia
(landing/paywall/trial) · L4 SEO+meranie · L5 GTM. Segment: primárne živnostníci
(AI+2027), sekundárne účtovníci. Rýchly platený MVP, default ceny.
- **L1 hotová:** právne stránky `/podmienky` `/ochrana-osobnych-udajov` `/cookies`
  `/kontakt` (SK šablóny — treba právnu kontrolu; údaje v `src/lib/site.ts`),
  zdieľaný `SiteFooter` + `LegalShell`, cookie banner (`useSyncExternalStore`),
  register súhlas checkbox + serverová poistka, **e-mail verifikácia ON**
  (`config.toml` `enable_confirmations=true`) → signUp bez session presmeruje na
  `/registracia-hotova`. 130/130, build green. NEDOTÝKAŤ pozn.: `SITE.company`
  má placeholdery `[DOPLŇ …]` — používateľ doplní reálne firemné údaje.
- **L3 + L4 + L2-kód hotové (dorob to celé):** 
  - **L3:** landing napojený na `PLANS` (reálne ceny + porovnávacia tabuľka + FAQ +
    sekcia 2027); in-context paywall `UpgradeDialog` + `UpgradeProvider`
    (shell layout) — gated actions vracajú `upgrade?: PlanTier` (documents/ai/
    einvoice/members), 4 call-sites otvárajú dialóg; 14-dňový Pro trial v checkoute;
    dashboard „Začíname" karta (first-run). Zdieľaný `feature-labels.ts`.
  - **L2-kód:** Stripe `automatic_tax` + `billing_address_collection` +
    `tax_id_collection` na checkout (aktivuje sa so Stripe Tax).
  - **L4:** `sitemap.ts`, `robots.ts`, OG/Twitter metadata + `metadataBase`,
    SEO magnet `/e-faktura-2027`, Plausible analytics (graceful, `analytics.tsx` +
    `analytics/track.ts`). Sentry ODLOŽENÉ (dokumentované v README).
  - 130/130, build green (nové routy /e-faktura-2027, /sitemap.xml, /robots.txt).
- **Landing copy + marketing (copywriting/launch/pricing/social/cold-email skills):**
  landing prepísaný na konverzný (`bd7818b`); `marketing/{launch-plan,pricing,
  social-posts,cold-email}.md` + `.agents/product-marketing-context.md` (`3433fbd`).
  Pricing odporúčanie: nechať 0/12/29 €, pridať ročné (−17 %), overiť WTP na beta.
- **Next (akcie používateľa):** env/kľúče (Stripe live+produkty+Tax, PLAUSIBLE,
  RESEND/UPSTASH), hosted Supabase+deploy+doména, firemné údaje v `src/lib/site.ts`,
  právna kontrola, reálne screenshoty, `scripts/pentest.sh` po deployi. Potom „GO L2"
  = sprievodca nasadením (Supabase → Vercel → Stripe).

### 2026-08-04: Produkčný výpadok — uspatá DB zhodila celý web (`ecbc8e5`)
Symptóm: intermitentné 504 (~13 % requestov, aj na landingu). Príčina: free-tier
Supabase `oukooqfpxeunhdzndsid` sa po ~7 dňoch nečinnosti uspal a **stratil DNS
záznam** → middleware (matcher chytal *každú* cestu) retryoval `auth.getUser()`
proti `ENOTFOUND` hostu až do 25 s limitu edge funkcie. Dôkazy: Vercel runtime
errors (`getaddrinfo ENOTFOUND` ×67/24 h, `stopped … within 25s` ×9), logy
(200:32 / 504:5 za 2 h), nezávislý `Resolve-DnsName` → *DNS name does not exist*.
- **Oprava (jadro):** `src/middleware.ts` matcher zúžený na `/app/:path*`,
  `/login`, `/register` — verejné, právne a SEO stránky sa DB **vôbec nedotknú**
  (overené v `.next/server/middleware-manifest.json`). `/app` ostáva chránené,
  `(shell)/layout.tsx:24` má vlastnú session kontrolu.
- `supabase/middleware.ts`: `AbortSignal.timeout(2500)` na fetch + 3 s rozpočet
  na celý refresh (`Promise.race`) → fail-open zaberie v sekundách, nie po 25 s.
- `actions/auth.ts`: `withSupabase()` wrapper — nedostupná služba vráti čitateľnú
  hlášku namiesto generického `global-error.tsx`. `redirect()` ostáva mimo `try`.
- `.github/workflows/supabase-keepalive.yml` — denný `vat_rates` select proti
  Postgresu (04:15 UTC), aby sa projekt už neuspával. **Potrebuje repo secrets
  `SUPABASE_URL` + `SUPABASE_ANON_KEY`.**
- Bonus: `ai/generate.ts` posielal `providerOptions.google` aj pod OpenRouterom
  (od `51a0f25` má prednosť) → nový `aiBackend()` v `ai/provider.ts`.
- Overené: 130/130, build PASS, lokálne bez DB `/` 0,2 s a `/app/*` → 307 login;
  po deployi 72/72 produkčných requestov 200, **0× 5xx za 25 min** (DB stále mŕtva).
- **Restore hotový (cez Supabase MCP):** projekt `ACTIVE_HEALTHY`, dáta prežili —
  22 tabuliek, 34 policies, 8 migrácií, 6 `vat_rates`, 2 orgs, 2 users.
  ⚠️ **Počas `COMING_UP` vracia DB prázdnu schému** (0 tabuliek, 0 users) —
  nie je to strata dát; pred akýmkoľvek zásahom počkaj na `ACTIVE_HEALTHY`.
- Keep-alive: repo secrets `SUPABASE_URL`/`SUPABASE_ANON_KEY` nastavené cez
  `gh secret set`, prvý beh HTTP 200 (`vat_rates` má stĺpec `code`, nie `id`).
  RLS vráti anonymovi `[]` — dotaz aj tak prejde do Postgresu, čo stačí.
- Finálne overenie: `/` `/v5` `/login` `/register` = 200, `/app/dashboard` = 307,
  runtime errors za 40 min **žiadne**.
- Advisori (WARN, nič kritické): `SECURITY DEFINER` RLS helpery sú zámer;
  odporúčané zapnúť **leaked password protection** v Auth nastaveniach a doplniť
  `search_path` funkcii `set_updated_at`.
- Pozn.: keď je DB dole, `/app` a login zostávajú nefunkčné — to je zámer, appka
  bez DB fungovať nemôže; ide o to, aby nepadal *verejný* web.
