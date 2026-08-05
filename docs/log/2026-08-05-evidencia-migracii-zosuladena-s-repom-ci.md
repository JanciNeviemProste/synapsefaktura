# 2026-08-05: Evidencia migrácií zosúladená s repom + CI poistka

Desať migrácií malo v `supabase_migrations.schema_migrations` zapísanú **inú
`version`, než mal súbor v repe** — MCP `apply_migration` si píše vlastnú
časovú pečiatku. `supabase db push` porovnáva verzie, nie názvy, takže by ich
videl ako nenasadené a pustil znova.

- **Skorší predpoklad („idempotencia to pokryje") bol nesprávny.** Overené:
  **šesť z desiatich by spadlo** — `foundation`, `invoicing`, `money_ops`,
  `ai_layer`, `einvoices`, `billing_members` majú `create table` bez
  `if not exists` a nestrážený `create type`. Bezpečné sú len tie štyri novšie
  (`numbering_system`, `member_role_guard`, `missing_modules`, `logbook`),
  písané už s guardmi.
- **Oprava:** jeden `update` v transakcii prepísal `version` na tú zo súboru;
  párovanie cez stĺpec `name`, ktorý sedel presne. Schéma sa nedotkla —
  zmenil sa len štítok už vykonanej migrácie. Kontrola _vnútri_ transakcie
  (`raise exception` → rollback) vyžadovala, aby po prepise sedelo všetkých 15
  záznamov a nezostal ani jeden bez súboru.
  Skript: `superfaktura-research/scripts/prod-fix-migration-versions.mjs`
  (bez `--apply` len náhľad), záloha `backups/schema_migrations-*.sql`.
- **Overené po zásahu:** 15/15 migrácií sedí s repom, 0 duplicít; počty
  nezmenené (36 tabuliek / 25 enumov / 81 policies / 9 funkcií);
  `save_document_with_items` stále zavretá; `/` `/login` 200, `/app/dashboard` 307.
- **Aby sa to nezopakovalo — nový CI job `migrations`:** postaví databázu od
  nuly zo súborov v repe (`postgres:17` service + `supabase/ci/pg-stub.sql`,
  bez Dockeru a Supabase CLI) a spadne, ak niektorá migrácia neprejde alebo
  ak nejaká `public` tabuľka nemá RLS. Navyše stráži jednoznačnosť názvov
  súborov — práve `name` bol jediné, čo túto opravu umožnilo.
