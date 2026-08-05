# 2026-08-04: Produkčný výpadok — uspatá DB zhodila celý web (`ecbc8e5`)

Symptóm: intermitentné 504 (~13 % requestov, aj na landingu). Príčina: free-tier
Supabase `oukooqfpxeunhdzndsid` sa po ~7 dňoch nečinnosti uspal a **stratil DNS
záznam** → middleware (matcher chytal _každú_ cestu) retryoval `auth.getUser()`
proti `ENOTFOUND` hostu až do 25 s limitu edge funkcie. Dôkazy: Vercel runtime
errors (`getaddrinfo ENOTFOUND` ×67/24 h, `stopped … within 25s` ×9), logy
(200:32 / 504:5 za 2 h), nezávislý `Resolve-DnsName` → _DNS name does not exist_.

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
  bez DB fungovať nemôže; ide o to, aby nepadal _verejný_ web.
