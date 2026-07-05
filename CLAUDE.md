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
| `pnpm lint` | ESLint (`next lint`) |
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
Voliteľné (feature sa aktivuje kľúčom): `GOOGLE_GENERATIVE_AI_API_KEY`, `AI_MODEL`,
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
- **Externé kľúče chýbajú** — AI/Stripe/Email/Upstash bežia graceful bez kľúča;
  produkcia potrebuje hosted Supabase + Vercel env.

## Stav (posledné 📊 — 2026-07-05)

`typecheck` PASS · `lint` PASS · `test` 130/130 PASS · `build` PASS.
Deploy-ready: **NIE** — blokátory: hosted Supabase env (akcia používateľa) +
neoverená SK legislatíva. Detailný report v session logu.

## Session log

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
- **Next (akcie používateľa):** env/kľúče (Stripe live+produkty+Tax, PLAUSIBLE,
  RESEND/UPSTASH), hosted Supabase+deploy+doména, firemné údaje v `src/lib/site.ts`,
  právna kontrola, reálne screenshoty, `scripts/pentest.sh` po deployi.
