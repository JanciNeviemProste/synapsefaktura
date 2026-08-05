# 2026-08-05: Dostavba — 11 položiek „zavedené, ale nikde nepoužité"

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
