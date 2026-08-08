# Stav projektu

> Aktualizuje ten, kto ako posledný mergoval na `main`. Jeden súbor, prepisuje
> sa celý — nedopisuj pod seba, inak sa vráti ten istý konflikt, kvôli ktorému
> táto sekcia odišla z `CLAUDE.md`.

## Posledné meranie — 2026-08-08

`main`: `format` · `typecheck` · `lint` · `test` **576/576** · `build` — všetko PASS.
**20 migrácií** sa aplikuje načisto na PostgreSQL 17 — 36 tabuliek, 0 bez RLS.

**RLS je po prvý raz overená, nie predpokladaná.** `supabase/tests/rls.sql`
beží v CI v jobe `migrations` a hlási 5× `ok` — vrátane _„člen firmy B nevidí
doklad firmy A"_. Do 2026-08-08 ten súbor nikdy nebežal a v hlavičke mal
napísané, že je to predpoklad.

Nasadené na `synapsefaktura.vercel.app`, Supabase `oukooqfpxeunhdzndsid` je
`ACTIVE_HEALTHY`, keep-alive beží.

### Registrácia funguje

Auth konfigurácia je od 2026-08-08 v repe (`supabase/config.toml`,
`[remotes.production]`), aplikuje sa cez `supabase config push`. Site URL je
`https://`, produkčný callback je v allow liste.

⚠️ **Potvrdzovanie e-mailom je dočasne vypnuté** — ktokoľvek sa vie
zaregistrovať na cudziu adresu. Zapnutie späť rieši **#35** a potrebuje overenú
doménu v Resende.

### Čo stráži stroj

|                                 |                                                                 |
| ------------------------------- | --------------------------------------------------------------- |
| `verify`                        | format, typecheck, lint, testy, build                           |
| `migrations`                    | migrácie načisto + RLS zapnutá + **RLS testy**                  |
| `Rozsah PR`                     | hlási počet riadkov (nepadá)                                    |
| `Zakázané vzory`                | `@ts-ignore`, `as any`, `eslint-disable`, prázdny catch         |
| ruleset                         | PR + 1 schválenie + **code owner review** + aktuálnosť s `main` |
| `no-restricted-imports`         | nový `createAdminClient()` mimo allowlistu = chyba              |
| `.claude/hooks/guard-paths.mjs` | zápis do cudzej lane sa opýta, do chránenej odmietne            |

### Blokátory predaja

Firemné údaje v `site.ts` (**#30**) · Stripe live (**#32**) · Peppol odosielanie
je stále **mock** · SK legislatíva — tri otvorené body (**#33**).

⚠️ V úložisku je zatiaľ **0 bucketov a 0 objektov**, 0 firiem s logom,
0 nákladov, 0 AI vyťažení — nahrávanie ani OCR tam ešte nikdy nebežalo.
