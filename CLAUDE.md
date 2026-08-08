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

| Príkaz                      | Popis                                |
| --------------------------- | ------------------------------------ |
| `pnpm dev`                  | Dev server (`next dev`)              |
| `pnpm build`                | Produkčný build                      |
| `pnpm typecheck`            | `tsc --noEmit`                       |
| `pnpm lint`                 | ESLint CLI (`eslint .`, flat config) |
| `pnpm test`                 | `vitest run`                         |
| `pnpm format`               | Prettier (zápis)                     |
| `pnpm db:start` / `db:stop` | Lokálny Supabase (Docker)            |
| `pnpm db:reset`             | Reaplikuje migrácie + seed           |
| `pnpm db:migrate`           | Aplikuje nové migrácie               |

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

## Stav a denník

Obe sekcie sú mimo tohto súboru — zámerne. Kým tu boli, dopisovali sme do nich
obaja na to isté miesto a `CLAUDE.md` bol jediný súbor, ktorý kolidoval na
každej vetve.

- **[docs/STATUS.md](docs/STATUS.md)** — aktuálny stav (testy, DB, blokátory).
  Prepisuje sa celý, aktualizuje ho ten, kto naposledy mergoval na `main`.
- **[docs/log/](docs/log/README.md)** — denník relácií, jedna relácia = jeden
  nový súbor `YYYY-MM-DD-<slug>.md`. Nový súbor nekoliduje nikdy.

## Spolupráca (dvaja ľudia na jednom repe)

**Skôr než napíšeš prvý riadok kódu**, prečítaj tieto dva súbory — nie sú
voliteľné a nie sú dlhé:

- **[docs/OWNERSHIP.md](docs/OWNERSHIP.md)** — kto vlastní ktoré cesty. Over,
  že súbory, ktorých sa ideš dotknúť, sú v **tvojej** lane. Ak nie, povedz to
  a zastav sa. Hook `.claude/hooks/guard-paths.mjs` to aj tak skontroluje, ale
  dozvedieť sa to až pri zápise je neskoro.
- **[specs/INDEX.md](specs/INDEX.md)** — čo si druhý práve claimol. Dve
  paralelné migrácie sú najhorší konflikt, aký tu vieme vyrobiť.

Celý postup relácie je v **[docs/WORKFLOW.md](docs/WORKFLOW.md)**.

- **Všetko cez pull request** — priamy push na `main` je zakázaný rulesetom,
  pre oboch. PR potrebuje 1 schválenie a zelené `verify` aj `migrations`.
- **Jeden PR = jedna téma, orientačne do 500 riadkov.** Väčší PR nikto
  neprečíta, takže sa ani neprečíta.
- **Vetvi z `main`**, nie z inej vetvy. Stack najviac 2 poschodia.
- **Kto na čom robí, má priradený GitHub Issue.** To je celá ochrana pred tým,
  aby sme dvakrát spravili to isté.
- **Databáza:** vývoj proti **lokálnemu** Supabase (`pnpm db:start`,
  `db:reset`). Migráciu overuje CI job `migrations` na prázdnom Postgrese.
  **Do produkčnej DB píše len vlastník repa** (`supabase db push` po merge).
- **Produktové rozhodnutia** (zrušiť funkciu, zmeniť dizajn, ceny) patria
  vlastníkovi — otvor issue alebo sa spýtaj v PR, nemerguj to potichu.
