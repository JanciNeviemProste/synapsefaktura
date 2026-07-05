# DECISIONS — Synapse Faktúra (ADR)

Architektúrne rozhodnutia, ADR štýl: čo · prečo · zamietnuté alternatívy.
Novšie hore.

## 2026-07-05 · Email doručovanie cez Resend REST + graceful stub
**Čo:** Odosielanie faktúr/upomienok cez Resend HTTP API (`fetch`), za `hasEmail()`
guardom; PDF príloha z existujúceho `@react-pdf/renderer`.
**Prečo:** Konzistentné s AI/Stripe graceful vzorom — bez `RESEND_API_KEY` appka
beží, len sa neodosiela. `fetch` namiesto SDK = žiadna nová ťažká závislosť.
**Zamietnuté:** Nodemailer/SMTP (konfig. réžia, horšia deliverability), pridanie
`resend` SDK (zbytočná závislosť pre pár volaní).

## 2026-07-05 · Durable rate-limit: Upstash Redis s in-memory fallbackom
**Čo:** `security/rate-limit.ts` použije Upstash Redis REST keď sú env kľúče,
inak súčasný per-process in-memory bucket.
**Prečo:** Serverless (Vercel) má viacero inštancií → in-memory limit netesní
naprieč nimi. Fallback zachová funkčnosť lokálne aj bez Redisu.
**Zamietnuté:** Vercel KV (deprecated), vlastná DB tabuľka (latencia, réžia).

## 2026-06-25 · Peppol transport za `DigitalPostmanProvider` interface (mock zatiaľ)
**Čo:** E-faktúra 2027 posiela cez interface; default `MockPostmanProvider`
(DB loopback). Reálny certifikovaný Digitálny poštár sa zapojí neskôr.
**Prečo:** Certifikovaný access point vyžaduje externú akreditáciu; interface
umožní vývoj a testovanie celej UBL/validation vrstvy bez blokovania.
**Zamietnuté:** priama integrácia jedného poskytovateľa (vendor lock-in, blokuje MVP).

## 2026-06-25 · Stripe billing v test-mode + graceful stub
**Čo:** Plný Stripe kód (checkout/portal/webhook/gating) za `hasStripe()`; bez
kľúčov je každá org Free, gating stále funguje.
**Prečo:** Umožní dokončiť billing UI/logiku pred obchodným rozhodnutím o cenách
a pred live kľúčmi.
**Zamietnuté:** odložiť billing celý (gating treba už teraz), hardcode plánov.

## 2026-06-25 · i18n cez next-intl: cookie locale, bez URL routingu
**Čo:** Jazyk (SK/CZ/EN) v cookie `locale`, default `sk`, deep-merge SK fallback;
doklady/PDF podľa `documents.language`.
**Prečo:** Netreba `/sk/…` prefixy ani duplicitné routy; SK je primárny trh.
**Zamietnuté:** locale-prefixed routing (réžia, SEO tu nepodstatné), i18next
(next-intl lepšie sedí App Routeru).

## 2026-06-24 · Graceful degradation ako prierezový vzor
**Čo:** `hasAiKey`/`hasStripe`/`hasEmail`/`supabaseEnv().configured` — chýbajúci
kľúč nezhodí build ani runtime, len vypne funkciu (fail-open na Edge middleware).
**Prečo:** Jedno nasadenie, postupné zapínanie integrácií; rieši Vercel
`MIDDLEWARE_INVOCATION_FAILED` pri chýbajúcom Supabase env.
**Zamietnuté:** hard-fail na chýbajúce env (rozbije celý web pri prvom deployi).

## 2026-06-24 · Stack: Next.js 15 + Supabase + Tailwind/shadcn + Vercel
**Čo:** App Router + Server Actions; Supabase (Postgres/Auth/RLS) ako multi-tenant
backend; Tailwind v4 + shadcn (Base UI); deploy Vercel.
**Prečo:** Rýchly solo-dev stack, RLS = bezpečná izolácia tenantov na DB úrovni,
Vercel natívny pre Next.
**Zamietnuté:** vlastný Node backend + Prisma (viac réžie, RLS by sa riešila v appke),
Postgres bez RLS (rizikovejšia izolácia).
