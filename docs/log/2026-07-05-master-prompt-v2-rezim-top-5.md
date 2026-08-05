# 2026-07-05: Master Prompt v2 režim — TOP 5 hardening

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
