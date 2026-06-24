# Synapse Faktúra

Moderná slovenská SaaS fakturácia s AI vrstvou, pripravená na povinnú e-faktúru
2027 (Peppol / EN 16931). Postavené podľa `SYNAPSE_FAKTURA_MASTER_PROMPT.md`.

> **Stav:** Fáza 0 — základy a scaffolding. Ďalšie fázy (fakturácia, AI, Peppol,
> billing) pribúdajú postupne podľa §8 master promptu.

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
