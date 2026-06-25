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

| Premenná | Povinné | Účel |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | áno | Supabase API URL (z `pnpm db:start`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | áno | Supabase publishable/anon kľúč |
| `SUPABASE_SERVICE_ROLE_KEY` | áno | Supabase service-role (server-only; systémové joby) |
| `NEXT_PUBLIC_APP_URL` | odporúčané | Verejná URL appky (Stripe redirecty, pozvánkové odkazy) |
| `CRON_SECRET` | pre cron | Chráni `/api/cron/*` (Vercel Cron `Authorization: Bearer`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | pre AI | Gemini kľúč pre AI vrstvu (capture, asistent, …) |
| `AI_MODEL` | nie | Override AI modelu (default `gemini-2.5-flash`) |
| `STRIPE_SECRET_KEY` | pre billing | Stripe secret (server-only) |
| `STRIPE_WEBHOOK_SECRET` | pre billing | Overenie podpisu webhooku `/api/stripe/webhook` |
| `STRIPE_PRICE_PRO` | pre billing | Stripe Price ID pre plán Pro |
| `STRIPE_PRICE_BUSINESS` | pre billing | Stripe Price ID pre plán Business |

> Jazyk UI (SK/CZ/EN) sa drží v cookie `locale` (default `sk`); netreba env.
> Doklady/PDF sa renderujú podľa `documents.language`.

## Nasadenie na Vercel

1. Import repo do Vercelu (framework: Next.js). `vercel.json` definuje cron joby.
2. Doplň env premenné z tabuľky vyššie (Supabase + voliteľne AI/Stripe/CRON).
3. Stripe: vytvor produkty Pro/Business, vlož `STRIPE_PRICE_*`, a nastav webhook
   na `https://<doména>/api/stripe/webhook` (event `checkout.session.completed`,
   `customer.subscription.*`).
4. V Supabase nastav produkčné `Site URL` + redirect na `/auth/callback`.

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
