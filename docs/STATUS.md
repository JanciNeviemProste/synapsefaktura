# Stav projektu

> Aktualizuje ten, kto ako posledný mergoval na `main`. Jeden súbor, prepisuje
> sa celý — nedopisuj pod seba, inak sa vráti ten istý konflikt, kvôli ktorému
> táto sekcia odišla z `CLAUDE.md`.

## Posledné meranie — 2026-08-05

`main`: `typecheck` PASS · `lint` PASS · `test` **564/564** PASS · `build` PASS.
`pnpm audit --prod` — **bez nálezu** (Next 15.5.22; zostáva 7 v ESLint nástrojoch).
**20 migrácií** sa aplikuje načisto na PostgreSQL 17 — 36 tabuliek, 0 tabuliek
bez RLS. To isté overuje CI job `migrations`.

Nasadené na `synapsefaktura.vercel.app`. Supabase `oukooqfpxeunhdzndsid` je
`ACTIVE_HEALTHY`. Keep-alive workflow beží (HTTP 200).
**Evidencia migrácií sedí s repom 1:1 — 20/20, nič nečaká na nasadenie**
(overené 2026-08-05, vrátane `20260805160000_trip_trailer`).
⚠️ V úložisku je zatiaľ **0 bucketov a 0 objektov**, 0 firiem s logom,
0 nákladov, 0 AI vyťažení — nahrávanie ani OCR tam ešte nikdy nebežalo.
Verejné stránky bežia aj bez databázy. Blokátory: Stripe/e-mail/analytics kľúče,
firemné údaje, neoverená SK legislatíva.
