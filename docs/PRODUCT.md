# Synapse Faktúra — čo staviame

Vyplnené z toho, čo v repe reálne je (`.agents/product-marketing-context.md`,
`marketing/`, landing, `billing/plans.ts`, `docs/DECISIONS.md`). Kde chýbal
podklad, je `TODO` a meno — **nedopĺňaj to odhadom**.

## Jedna veta

Slovenská fakturácia s AI vrstvou, postavená na Peppol / EN 16931 od základu —
pripravená na povinnú e-faktúru od 1. 1. 2027.

## Kto to platí

- **Primárne:** slovenskí živnostníci a malé firmy — freelanceri, remeselníci,
  konzultanti, malé s.r.o. Chcú málo administratívy a istotu v DPH.
- **Sekundárne:** účtovníci spravujúci viac firiem. Prepínanie organizácií pod
  jedným účtom je hotové.

<!-- TODO(@JanciNeviemProste): koľko faktúr mesačne reálne vystavujú a čo
     používajú dnes. Toto sa dá zistiť len rozhovorom, nie z kódu. -->

## Prečo teraz

Od **1. 1. 2027** je e-faktúra povinná pre **platiteľov DPH** — novela zákona
č. 222/2004 Z. z. Faktúra musí ísť v štruktúrovanom formáte (UBL 2.1 podľa
EN 16931) cez sieť **Peppol**, s reportovaním do **IS EFA** Finančnej správy.
SR zvolila 5-corner model. Peppol ID pre SK subjekty je `0245:<10-miestne DIČ>`.

Netýka sa to len veľkých firiem — **každého registrovaného platiteľa DPH bez
ohľadu na obrat**. Testovacie prostredie a zoznam certifikovaných „digitálnych
poštárov" sa očakávajú v priebehu 2026.

To je celý obchodný prípad. Nie „lepšie UI".

> Sankcie podľa doterajších návrhov do 10 000 €, pri opakovaní viac — **presné
> sumy potvrdí až finálne znenie predpisu**, netvrď ich ako fakt.
> Overené body a zdroje sú v `docs/DECISIONS.md`, tabuľka §5.

## Voči čomu súťažíme

SuperFaktúra, iKros/Kros, Fakturoid (CZ), Billdu. Cenovo sú rádovo v jednotkách
až nižších desiatkach € mesačne.

**Klin nie je nižšia cena.** Sú to dve veci: AI vrstva a to, že Peppol /
EN 16931 je tu od základu, nie dolepený.

<!-- TODO(@JanciNeviemProste): v čom sú oni konkrétne lepší. Vedieť to je
     dôležitejšie než vedieť, v čom sme lepší my. -->

## Čo produkt vie (dnes, v kóde)

Obrazovky: dashboard · faktúry (aj cenové ponuky a dodacie listy) · AI asistent ·
kontakty · produkty · výdavky · e-faktúry · banka · pokladňa · kniha jázd ·
opakované faktúry · reporty · nastavenia.

Za nimi:

- **AI** — vyťaženie bločkov a prijatých faktúr z fotky, faktúra napísaná jednou
  vetou, asistent nad vlastnými dátami, kontrola náležitostí. Má vlastný
  mesačný rozpočet a rate limit.
- **DPH** — sadzby 23/19/5 %, právne poznámky, kontrola pred odoslaním.
- **Peppol / EN 16931** — generovanie aj príjem UBL 2.1, validácia, Peppol ID.
- **Peniaze** — import bankových výpisov, párovanie platieb, upomienky,
  prognózy cash-flow, detekcia anomálií.
- **Účtovníkovi** — export do účtovných systémov, KV/SV pre FS SR.
- **Registre** — RPO a VIES lookup podľa IČO.

## Čo vedome nerobíme

Zapísané rozhodnutia, nie domnienky (`docs/DECISIONS.md`):

- **Vlastný backend ani ORM.** Supabase + RLS je izolácia medzi firmami.
- **Jeden LLM backend** (Gemini 2.5 Flash, OpenRouter voliteľne). Routing medzi
  viacerými poskytovateľmi je réžia bez zmeraného prínosu.
- **Žiadny URL-based i18n routing.** Jazyk v cookie, žiadne `/sk/` prefixy.
- **Neintegrujeme jedného Peppol poskytovateľa napevno** — je za rozhraním,
  aby nevznikol vendor lock-in.
- **Nepadáme na chýbajúcom kľúči.** Chýbajúci AI/Stripe/e-mail kľúč funkciu
  vypne, nezhodí build.

<!-- TODO(@JanciNeviemProste): doplniť PRODUKTOVÝ scope, nie technický —
     robíme mzdy? podvojné účtovníctvo? sklad je v kóde, ale je to zámer alebo
     vedľajší produkt? Toto je najužitočnejšia sekcia pre agenta, lebo mu
     bráni „domyslieť si" rozsah. -->

## Ceny — neplatné, čakajú na potvrdenie

`src/lib/billing/plans.ts` má `TODO: confirm` na každom čísle.

| Plán     | Cena     | Doklady/mes. | Čo navyše                                         |
| -------- | -------- | ------------ | ------------------------------------------------- |
| Free     | 0 €      | 5 _(TODO)_   | príjem e-faktúr, 1 používateľ                     |
| Pro      | 12 €/mes | neobmedzene  | AI: vyťaženie, faktúra vetou, asistent, upomienky |
| Business | 29 €/mes | neobmedzene  | + prognózy, viac používateľov, odosielanie, API   |

Pro má 14 dní zdarma. `marketing/pricing.md` odporúča overiť ochotu platiť
Van Westendorpom na 10–15 beta používateľoch — **zatiaľ sa nestalo**.

## Doménový slovník

Z reálnej schémy (`src/lib/supabase/database.types.ts`). Názvy v DB sú
snake_case a **slovenské tam, kde ide o slovenský pojem** — je to zámer.
Neprekladaj ich do angličtiny.

| Slovensky                    | V kóde                                  | Čo to je                               |
| ---------------------------- | --------------------------------------- | -------------------------------------- |
| faktúra, dobropis, ťarchopis | `documents` + stĺpec `document_type`    | jedna tabuľka, typ rozlišuje doklad    |
| položky dokladu              | `document_items`                        |                                        |
| odberateľ / dodávateľ        | `contacts`                              | jedna tabuľka pre oboch                |
| DPH                          | `vat_rates`, `vat_mode`, `is_vat_payer` | sadzba / režim / či je firma platiteľ  |
| IČO / DIČ / IČ DPH           | `ico` / `dic` / `ic_dph`                | tri rôzne čísla, nezamieňať            |
| variabilný symbol            | `variable_symbol`                       | párovanie platby, nie je to ID faktúry |
| dátum vystavenia / dodania   | `issue_date` / `supply_date`            | daňovo rozdielne, nezlučovať           |
| číselný rad                  | `number_sequences`                      | odtiaľ berie `next_document_number()`  |
| e-faktúra                    | `einvoices`, `src/lib/peppol/`          | Peppol sieť / UBL 2.1 / BIS 3.0        |
| kniha jázd                   | `trips`, `vehicles`, `refuelings`       |                                        |
| organizácia a členovia       | `organizations`, `organization_members` | základ multi-tenancy a RLS             |

## Nemenné pravidlá produktu

Toto nie sú technické preferencie — toto robí faktúru právne platnou.

1. **Číslovanie je bez medzier a nemenné.** Prideľuje ho databáza cez
   `next_document_number(org, typ, rok)`, nie aplikácia. Nikdy sa negeneruje
   znova, nepresúva ani nerecykluje.
2. **Vystavená faktúra sa needituje.** Oprava = nový doklad odkazujúci na pôvodný.
3. **Peniaze sú `number` zaokrúhľované half-up na centy** (`src/lib/money.ts`),
   nie `Decimal`. Zaokrúhľuje sa na každej hranici riadku aj dokladu; DPH **po
   skupinách sadzieb, nie po riadkoch** (EN 16931).
4. **Všetko je tenant-scoped.** Drží to RLS. Výnimka je `createAdminClient()`,
   kde to musí ustrážiť kód — dotaz bez kontroly organizácie nie je bug, je to
   únik dát.
5. **Peppol výstup musí prejsť validáciou BIS 3.0.** Nevalidovaný nie je hotový.

## Tón a zákaz vymýšľania

Slovensky, priateľsky a priamo, bez korporátnych fráz. Tykanie.

**Nemáme žiadne reálne štatistiky ani referencie zákazníkov.** Produkt je pred
spustením. Do marketingových textov nikdy nepíš vymyslené čísla, prípadové
štúdie ani mená — ani ako „príklad".

## Čo blokuje predaj

- Firemné údaje v `src/lib/site.ts` sú `[DOPLŇ …]` — issue #30.
- Stripe beží v test-mode, ceny nepotvrdené — issue #32.
- Peppol odosielanie je **mock** (loopback), čaká na certifikovaného poštára.
- Potvrdzovanie e-mailom vypnuté, kým nebude overená doména v Resende — #35.
