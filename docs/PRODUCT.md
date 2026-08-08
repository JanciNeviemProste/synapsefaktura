# Synapse Faktúra — čo staviame

> **Kostra.** Vyplň ju ty, @JanciNeviemProste — toto je jediný dokument v setupe, ktorý agent nesmie vymyslieť.
> Ak máš master build spec, presuň ho sem alebo naň odtiaľto odkáž a zvyšok zmaž.
> Potom spusti `/map-codebase`, ktorý doplní zvyšok z reálneho kódu.

## Jedna veta

<!-- TODO: @JanciNeviemProste — čo to je a pre koho. Bez marketingu. -->

## Kto to platí

<!-- TODO: SZČO? malé s.r.o.? účtovníci? Koľko faktúr mesačne? Čo používajú dnes? -->

## Prečo teraz

Od **2027** je elektronická fakturácia na Slovensku povinná. Väčšina existujúcich nástrojov na to
nie je pripravená natívne. To je celý obchodný prípad — nie „lepšie UI".

<!-- TODO: doplniť presný rozsah povinnosti a dátumy, s odkazom na zdroj -->

## Voči čomu súťažíme

**SuperFaktúra.sk** — <!-- TODO: v čom sú dobrí a čo konkrétne robíme lepšie. Buď konkrétny;
„lepší UX" nie je odpoveď, ktorá by komukoľvek pomohla rozhodnúť sa v kóde. -->

## Čo produkt vie (dnes)

<!-- TODO: zoznam funkcií, ktoré sú v produkcii. Nie plán. -->

## Čo vedome nerobíme

<!-- TODO: toto je najužitočnejšia sekcia pre agenta — bráni tomu, aby „domyslel" scope.
Napr.: nerobíme mzdy, nerobíme sklad, nerobíme podvojné účtovníctvo. -->

## Doménový slovník

Doplnené z reálnej schémy (`src/lib/supabase/database.types.ts`), nie z hlavy.
Názvy v DB sú **snake_case a slovenské tam, kde ide o slovenský pojem** — je to
zámer, nie neporiadok. Neprekladaj ich do angličtiny.

| Slovensky                  | V kóde                                        | Čo to je                               |
| -------------------------- | --------------------------------------------- | -------------------------------------- |
| faktúra, dobropis, ťarchopis | tabuľka `documents`, stĺpec `document_type`  | jedna tabuľka, typ rozlišuje doklad     |
| položky dokladu            | `document_items`                              |                                        |
| odberateľ / dodávateľ      | `contacts`                                    | jedna tabuľka pre oboch                |
| DPH                        | `vat_rates`, `vat_mode`, `is_vat_payer`       | sadzba / režim / či je firma platiteľ  |
| IČO / DIČ / IČ DPH         | `ico` / `dic` / `ic_dph`                      | tri rôzne čísla, nezamieňať            |
| variabilný symbol          | `variable_symbol`                             | párovanie platby, nie je to ID faktúry |
| dátum vystavenia / dodania | `issue_date` / `supply_date`                  | daňovo rozdielne, nezlučovať           |
| číselný rad                | `number_sequences`                            | odtiaľ berie `next_document_number()`  |
| e-faktúra                  | `einvoices`, `src/lib/peppol/`                | Peppol sieť / UBL 2.1 formát / BIS 3.0 |
| kniha jázd                 | `trips`, `vehicles`, `refuelings`             |                                        |
| organizácia a členovia     | `organizations`, `organization_members`       | základ multi-tenancy a RLS             |

<!-- TODO: @JanciNeviemProste — doplniť kontrolný a súhrnný výkaz, keď bude
     známy tvar FS SR XSD (issue #33). -->

## Nemenné pravidlá produktu

Toto nie sú technické preferencie, toto je to, čo robí faktúru právne platnou.

1. **Číslovanie je bez medzier a nemenné.** Prideľuje ho databáza cez
   `next_document_number(org, typ, rok)`, nie aplikácia. Nikdy sa negeneruje
   znova, nepresúva ani nerecykluje.
2. **Vystavená faktúra sa needituje.** Oprava = nový doklad, ktorý odkazuje na
   pôvodný.
3. **Peniaze sú `number` zaokrúhľované half-up na centy** (`src/lib/money.ts`),
   nie `Decimal`. Zaokrúhľuje sa na každej hranici riadku aj dokladu, aby sa
   chyba nekumulovala; DPH **po skupinách sadzieb, nie po riadkoch** (EN 16931).
4. **Všetko je tenant-scoped.** Drží to RLS. Jediná výnimka je
   `createAdminClient()`, kde to musí ustrážiť kód — dotaz bez kontroly
   organizácie nie je bug, je to únik dát.
5. **Peppol výstup musí prejsť validáciou BIS 3.0.** Nevalidovaný výstup nie je
   hotový.

<!-- TODO: @JanciNeviemProste — doplniť ďalšie, ktoré vieš z praxe. -->
