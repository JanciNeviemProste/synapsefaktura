# 2026-08-04: Externý prispievateľ — migrácie fáz 3 a 4 aplikované cez MCP

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
  čo filtruje podľa _base_ vetvy; #3–#7 mieria na predošlé vetvy stacku. Bežia len
  GitGuardian + Vercel build. Overené lokálne na vrchole stacku: typecheck PASS,
  `eslint .` PASS, **324/324 testov**. Opravené na `main`: `pull_request` už
  nemá `branches` filter, takže checky bežia aj na stacked PR.
- Produkcia nedotknutá: `/` `/login` 200, `/app/dashboard` 307, runtime errors 0.
  Security advisors bez nového nálezu.
- **Schéma je pred kódom** — 14 prázdnych tabuliek, ktoré nasadený kód nepozná.
  Inertné; ak by PR neprešli, treba ich manuálne dropnúť.
- Otvorené: review a merge PR #2–#7 (poradie stacku je záväzné).
