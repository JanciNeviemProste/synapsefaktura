# 2026-08-08: Z dohody na kontrolu strojom

Ráno sme mali dohodu o spolupráci napísanú v texte. Večer je väčšina z nej
vynútená strojom. Medzitým sa našli tri veci, ktoré text nikdy nechytil.

## Východisko: polovica scaffoldu stála na disciplíne

Po nainštalovaní tímového setupu (#37) bola otázka jednoduchá — bude kód
naozaj lepší? Poctivá odpoveď znela: sčasti. `specs/INDEX.md` funguje, len keď
doň obaja píšu. `/start-work` pomôže, len keď ho niekto spustí. **Nič to
nevynucovalo.**

Zvyšok dňa bol o premene dohôd na kontroly, ktoré vedia zhodiť build.

## Najdôležitejší nález: testy izolácie nikdy nebežali

`supabase/tests/rls.sql` má 5 pgTAP testov na to, že firma nevidí doklady inej
firmy. V hlavičke stálo:

> STAV: NAPÍSANÉ, ZATIAĽ NESPUSTENÉ … Do tej doby je to PREDPOKLAD, nie dôkaz.

Job `migrations` overoval, že RLS je **zapnutá** na každej tabuľke. To nie je to
isté ako či politiky robia, čo majú.

Prvý beh spadol na `permission denied for table documents` — a bolo to
poučné: **nebola to chyba politiky, ale stubu.** RLS je druhá vrstva, prvá je
obyčajný GRANT. Supabase ich nastaví pri zakladaní projektu, takže migrácie ich
neobsahujú a `pg-stub.sql` o nich nevedel.

Po doplnení `alter default privileges` prešlo všetkých 5. Vrátane
_„člen firmy B NEVIDÍ doklad firmy A"_.

Že to nie sú falošne zelené testy, dokazuje kombinácia: keby `auth.uid()`
nefungovala, spadol by test 1. Prejsť test 1 **aj** test 2 sa dá jedine tak, že
politiky naozaj rozlišujú.

## Dve diery v org scopingu

**`renderInvoicePdf` mal `orgId` nepovinný.** Keď neprišiel, vypli sa všetky
filtre naraz vrátane `.limit(1)` na `organizations` — ten potom vrátil ľubovoľnú
firmu. A `documents.ts` ho tak naozaj volal (`orgId ?? undefined`), takže sa
vypli presne v tom prípade, pred ktorým komentár o riadok vyššie varoval. Pri
cron behu to RLS nekryje ničím.

**`imageDataUrl` sťahovala service-role klientom ľubovoľnú cestu** z bucketu
`attachments` — teda aj podpis cudzej firmy. Kryla to len zhoda okolností.

**`resolveOrg` verila dodanému `orgId`.** Namiesto komentára „volajúci si to
musí overiť sám" tam teraz je krížová kontrola voči session.

Opravené s 12 testami. Že testujú, je overené vrátením opravy: bez kontroly
prefixu spadli 4, bez krížovej kontroly 1.

## Vlastné hlásenie, ktoré som musel odvolať

`peppol/provider/mock.ts` som hlásil ako tretiu dieru. **Nie je ňou.** Scoping
tam drží `receiver_peppol_id` (`0245:<DIČ>`, DIČ je unikátne) — filter na
príjemcu _je_ filter na firmu, len iným kľúčom. Pridanie `organization_id` by
navyše rozbilo loopback.

## Dve pasce, ktoré si CI nachystalo samo

**Job „Zakázané vzory" padol na vlastnej PR a mal pravdu len naoko.** Rátal iba
`+` riadky; pri preformátovaní sa existujúci `eslint-disable-next-line` prelomil
na iný riadok a javil sa ako pridaný. Teraz sa porovnáva pridané voči
odstráneným. Falošný poplach je horší než žiadna kontrola — naučí ľudí ignorovať
červené krížiky.

**`format:check` padal na Windows každému.** Hneď po `git checkout main` hlásil
118 súborov, hoci v gite boli všetky správne: `core.autocrlf` prepíše LF na
CRLF, prettier má predvolené `endOfLine: lf`. V CI na Linuxe to prešlo, u oboch
z nás nie. Rieši `.gitattributes` s `eol=lf`.

## Vedľajší efekt, ktorý rozhoduje o používaní

`incremental: true` bez `tsBuildInfoFile` pri `noEmit` neukladá nič. PostToolUse
hook púšťa typecheck po **každom uložení súboru** — pri 78 s by ho človek do
týždňa vypol. Po doplnení: **34 s studený beh, 11 s druhý.**

## Čo sa zmenilo v ruleset

`require_code_owner_review` bolo `false` — `CODEOWNERS` bol do dnes iba
dekorácia. Pribudli povinné checky `Rozsah PR` a `Zakázané vzory`
a `strict_required_status_checks_policy`, aby sa dva zelené PR nemohli zraziť
na `main`.

Bypass vlastníka zostáva. Bez neho Romanova neprítomnosť blokuje všetko.

## Otvorené

- **#35** potvrdzovanie e-mailom — kým je vypnuté, dá sa registrovať na cudziu
  adresu
- `docs/PRODUCT.md` má 4 `TODO`, ktoré sa z kódu zistiť nedajú
- `CLAUDE_CODE_OAUTH_TOKEN` nie je nastavený — `claude.yml` sa ticho preskakuje
- Roman si musí nastaviť `SYNAPSE_DEV=roman`; stráž ho na to upozorní sama
