# 2026-08-05: Pravidlá spolupráce a rozvrstvenie prístupov

Dvaja ľudia (vlastník + `csrom`) robia na jednom repe súčasne. Od `ac75f6b`
pribudlo **27 816 riadkov v 216 súboroch**, všetko zmergoval autor sám. Nič
z toho nevidel druhý pár očí. Táto relácia nepridáva funkcie — nastavuje
mantinely a kontroluje, čo pribudlo.

## Kontrola pribudnutého kódu — čo obstálo

- **564 testov / 52 súborov PASS** (predtým 173), CI zelené na každom PR aj pushi.
- **CI job `migrations`** (PR #11) pustí všetky migrácie na prázdny Postgres
  v poradí názvov, stráži unikátnosť verzií a **padne, ak verejná tabuľka nemá
  RLS**. Presne to, čo „aplikoval som to na produkciu a prešlo to" nedokáže.
- **Eskalácia práv nájdená a zavretá autorom.**
  `save_document_with_items` je `security definer` a zoznam zapisovaných stĺpcov
  berie z toho, čo pošle klient. Cez `POST /rest/v1/rpc/save_document_with_items`
  si mohol ktokoľvek prihlásený nastaviť `total`, `paid_amount`, `status` alebo
  `number` priamo — s obídením serverového prepočtu. Zavreté v
  `20260805090000_lock_save_document_rpc.sql`
  (`revoke execute from public, anon, authenticated`); Supabase advisor to už
  nehlási.
- **Evidencia migrácií zosúladená.** 10 migrácií bolo zapísaných pod timestampmi
  z `apply_migration` cez MCP, ktoré nesedeli s názvami súborov —
  `supabase db push` by ich pustil znova a **6 najstarších nie je
  idempotentných**. Teraz 20 súborov = 20 záznamov.

## Recenzia plochy, kde neplatí RLS — bez nálezu

`createAdminClient()` (service role, obchádza RLS) je v **14 súboroch**.
Prejdené všetky vstupné body:

| Vstup                                               | Čo ho drží                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `documents.saveDocument`                            | `docRow.organization_id` z `getCurrentOrgId`; RPC pri UPDATE filtruje `and d.organization_id = …` |
| `uploads`, `expenses`, `org` branding, `ai-capture` | cesta v úložisku musí začínať `${orgId}/` — inak „súbor sa nenašiel"                              |
| `cash-registers`                                    | `belongsToOrg` pred pridelením čísla z radu                                                       |
| `travel-rates`                                      | `owner`/`admin` rola, riadky sú globálne (`organization_id is null`)                              |
| `members.listMembers`                               | `auth.users` nie je cez RLS dostupná; dotaz obmedzený na `user_id` členov tejto firmy             |
| `members.acceptInvite`                              | zámerne — pozvaný ešte nie je členom, drží to token + expirácia                                   |
| 5× `api/cron/*`                                     | `isCronAuthorized` — **fail-closed**, bez `CRON_SECRET` odmieta všetko                            |
| `api/stripe/webhook`                                | `stripe.webhooks.constructEvent` s podpisom                                                       |
| `lib/jobs/*`, `peppol/mock`                         | systémové cesty bez session, service role je tam správne                                          |

Únik medzi organizáciami sa nenašiel. Zostáva ale platiť, že **databáza už tieto
miesta nekryje** — org scoping tam drží človek, nie RLS.

## Čo sa zmenilo v repe

- **`CLAUDE.md` 656 → 113 riadkov.** `## Stav` → `docs/STATUS.md` (prepisuje sa
  celý), `## Session log` → `docs/log/*.md` (jedna relácia = jeden nový súbor).
  Dôvod je mechanický: obaja sme dopisovali na to isté miesto, takže `CLAUDE.md`
  bol jediný súbor, ktorý kolidoval na **každej** vetve. Nový súbor nekoliduje.
- **`CODEOWNERS`** — PR si sám vypýta recenzenta.
- **Ruleset na `main`** — priamy push zakázaný **pre oboch**, PR potrebuje
  1 schválenie a zelené `verify` aj `migrations`. Výnimka pre vlastníka by celé
  pravidlo zrušila, takže tam nie je.
- Pravidlá spolupráce zapísané priamo v `CLAUDE.md`, aby ich videl aj agent.

## Otvorené — vyžaduje kroky vlastníka mimo repa

- **Rotovať `SUPABASE_SERVICE_ROLE_KEY`** — obchádza RLS a bol dostupný aj
  druhej strane.
- **Rozvrstviť databázu:** vývoj = lokálny Supabase (`pnpm db:start`, už je
  nastavený vrátane `seed.sql`), spoločné testovanie = druhý _free_ projekt,
  produkcia = len vlastník. Dnes je v produkcii **3 orgs / 3 users / 3 doklady**
  cudzích testovacích dát.
- `SUPABASE_DB_URL` naďalej **nedávať** — repo je verejné, rola `postgres`
  obchádza RLS, odvolanie = reset hesla DB.
- Zapnúť _leaked password protection_ (visí v Supabase advisoroch).
- **Tmavý režim:** otvorený PR #24 ho ruší úplne (50× `dark:` v 14 súboroch,
  `next-themes` preč). Je to produktové rozhodnutie vlastníka, nie technické.
