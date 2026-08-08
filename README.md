# Synapse Faktúra

Moderná slovenská SaaS fakturácia s AI vrstvou, pripravená na povinnú e-faktúru
2027 (Peppol / EN 16931). Postavené podľa `SYNAPSE_FAKTURA_MASTER_PROMPT.md`.

> **Stav:** Fázy 0–5 hotové — základy, fakturácia, money ops, AI vrstva,
> e-faktúra 2027 (Peppol) a billing/multi-user/i18n/polish. Externé integrácie
> (AI kľúče, Stripe, certifikovaný Digitálny poštár, SMTP/SMS) bežia v
> graceful/test režime — doplň kľúče do env a aktivujú sa.

## Stack

- **Next.js 15** (App Router, Server Actions), TypeScript (strict)
- **Tailwind v4** + **shadcn/ui** + lucide-react
- **react-hook-form** + **zod**
- **Supabase** (Postgres, Auth, RLS) — lokálne cez Supabase CLI + Docker
- **pnpm**

## Lokálne spustenie

Predpoklady: Node 20+, **pnpm**, **Docker Desktop** (pre lokálny Supabase),
Supabase CLI.

```bash
pnpm install

# 1) Spusti lokálny Supabase stack (vyžaduje bežiaci Docker)
pnpm db:start          # vypíše API URL + anon/service kľúče
pnpm db:reset          # aplikuje migrácie + seed (vat_rates)

# 2) Priprav env premenné
cp .env.example .env.local
# do .env.local doplň NEXT_PUBLIC_SUPABASE_ANON_KEY a SUPABASE_SERVICE_ROLE_KEY
# z výpisu `pnpm db:start`

# 3) Spusti aplikáciu
pnpm dev               # http://localhost:3000
```

## Skripty

| Skript            | Popis                             |
| ----------------- | --------------------------------- |
| `pnpm dev`        | Vývojový server                   |
| `pnpm build`      | Produkčný build                   |
| `pnpm typecheck`  | `tsc --noEmit`                    |
| `pnpm lint`       | ESLint                            |
| `pnpm format`     | Prettier (zápis)                  |
| `pnpm db:start`   | Štart lokálneho Supabase (Docker) |
| `pnpm db:reset`   | Reaplikuje migrácie + seed        |
| `pnpm db:migrate` | Aplikuje nové migrácie            |

## Environment premenné

Skopíruj `.env.example` do `.env.local` a doplň. Všetky tajné kľúče sú
server-side; do klienta idú len `NEXT_PUBLIC_*`. Externé služby degradujú
graceful — bez kľúča appka beží, len daná funkcia je vypnutá.

| Premenná                        | Povinné        | Účel                                                                                          |
| ------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | áno            | Supabase API URL (z `pnpm db:start`)                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | áno            | Supabase publishable/anon kľúč                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | áno            | Supabase service-role (server-only; systémové joby)                                           |
| `NEXT_PUBLIC_APP_URL`           | odporúčané     | Verejná URL appky (Stripe redirecty, pozvánkové odkazy)                                       |
| `CRON_SECRET`                   | pre cron       | Chráni `/api/cron/*` (Vercel Cron `Authorization: Bearer`)                                    |
| `GOOGLE_GENERATIVE_AI_API_KEY`  | pre AI         | Gemini kľúč pre AI vrstvu (capture, asistent, …)                                              |
| `AI_MODEL`                      | nie            | Override AI modelu (default `gemini-2.5-flash`)                                               |
| `STRIPE_SECRET_KEY`             | pre billing    | Stripe secret (server-only)                                                                   |
| `STRIPE_WEBHOOK_SECRET`         | pre billing    | Overenie podpisu webhooku `/api/stripe/webhook`                                               |
| `STRIPE_PRICE_PRO`              | pre billing    | Stripe Price ID pre plán Pro                                                                  |
| `STRIPE_PRICE_BUSINESS`         | pre billing    | Stripe Price ID pre plán Business                                                             |
| `RESEND_API_KEY`                | pre e-mail     | Resend API kľúč (odosielanie faktúr a upomienok; bez neho sa len prepne status)               |
| `EMAIL_FROM`                    | pre e-mail     | Overený odosielateľ, napr. `Faktúry <faktury@tvoja-domena.sk>`                                |
| `UPSTASH_REDIS_REST_URL`        | pre rate-limit | Upstash Redis REST URL (zdieľaný rate-limit naprieč inštanciami; bez neho in-memory fallback) |
| `UPSTASH_REDIS_REST_TOKEN`      | pre rate-limit | Upstash Redis REST token                                                                      |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`  | pre analytiku  | Doména v Plausible (napr. `synapsefaktura.sk`); bez nej sa analytika nenačíta                 |

> **Stripe DPH:** checkout má zapnuté `automatic_tax` + zber adresy/IČ DPH a
> 14-dňový trial. Aby DPH reálne počítalo, zapni **Stripe Tax** v Stripe dashboarde.
>
> **Sentry (voliteľné):** error monitoring nie je predinštalovaný (vyžaduje
> `@sentry/nextjs` + wizard). Vercel má vstavané runtime logy; Sentry doplň podľa
> potreby cez `npx @sentry/wizard`.

> Jazyk UI (SK/CZ/EN) sa drží v cookie `locale` (default `sk`); netreba env.
> Doklady/PDF sa renderujú podľa `documents.language`.

## Nasadenie na Vercel

> ⚠️ **Lokálny Supabase (Docker) nestačí** — Vercel sa naň nevie pripojiť.
> Produkcia potrebuje **hosted Supabase projekt**. Bez nastavených
> `NEXT_PUBLIC_SUPABASE_URL` / `…_ANON_KEY` sa appka nezrúti (middleware degraduje
> graceful — verejné stránky fungujú), ale prihlásenie a `/app` budú nefunkčné,
> kým env nedoplníš.

1. **Vytvor hosted Supabase projekt** na [supabase.com](https://supabase.com)
   (región EÚ kvôli GDPR/§9).
2. **Aplikuj migrácie na hosted DB** (z koreňa repo):
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push          # aplikuje supabase/migrations/*
   ```
   Potom v Supabase **SQL editore** spusti obsah `supabase/seed.sql` (vat_rates).
3. **Skopíruj kľúče** zo Supabase → Settings → API: `Project URL`,
   `anon`/publishable a `service_role`/secret.
4. **Import repo do Vercelu** (framework: Next.js; `vercel.json` definuje cron joby).
5. **Nastav env premenné vo Verceli** (Settings → Environment Variables, pre
   Production aj Preview) podľa tabuľky vyššie — minimálne:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (nasadená doména),
   `CRON_SECRET` (náhodný reťazec). Voliteľne `GOOGLE_GENERATIVE_AI_API_KEY`,
   `STRIPE_*`. **Redeploy** (env sa do `NEXT_PUBLIC_*` zapečie pri builde).
6. **Supabase → Auth → URL Configuration**: `Site URL` = nasadená doména,
   pridaj redirect `https://<doména>/auth/callback`; zapni email (Google voliteľne).
7. **Stripe (voliteľné)**: vytvor produkty Pro/Business, vlož `STRIPE_PRICE_*`,
   nastav webhook na `https://<doména>/api/stripe/webhook`
   (`checkout.session.completed`, `customer.subscription.*`).

## Štruktúra

```
src/
  app/
    page.tsx                 # marketing landing (/)
    (auth)/login|register    # prihlásenie / registrácia
    app/                     # chránená oblasť (/app/**)
      onboarding/            # sprievodca nastavením firmy (IČO autofill z RPO)
      (shell)/dashboard/     # dashboard so sidebar shellom
    auth/callback/route.ts   # OAuth / email callback
    actions/                 # Server Actions (auth, org, registry)
  lib/
    supabase/                # @supabase/ssr klienti + middleware
    registry/                # RPO IČO lookup (swappable provider)
    validation/              # zod schémy
supabase/
  migrations/                # SQL migrácie (foundation)
  seed.sql                   # vat_rates
  config.toml                # lokálna Supabase konfigurácia
```

## Slovak compliance

Sadzby DPH, povinné náležitosti faktúry a Peppol 2027 sa riadia §5 master
promptu. Miesta označené `// TODO: verify` treba pred produkciou overiť proti
oficiálnym zdrojom Finančnej správy.
