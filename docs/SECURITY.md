# SECURITY — Synapse Faktúra

Stav bezpečnostného checklistu (Master Prompt v2 §6A) + výsledky mini-pentestu
(§6B). Aktualizovať pri každej fáze so security dopadom.

## §6A Checklist — stav k 2026-07-05

| Oblasť                          | Stav | Dôkaz / Poznámka                                                                                                       |
| ------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------- |
| RLS na každej tabuľke           | ✅   | Každá dátová migrácia `enable row level security` + policies (org-scoped cez `organization_members`).                  |
| Owner-escalation guard          | ✅   | `20260625140000_member_role_guard.sql` (USING+WITH CHECK `role <> 'owner'`).                                           |
| Server-side auth check          | ✅   | Server Actions overujú org cez `getCurrentOrgId`/RLS; `(shell)` layout guard.                                          |
| Input validácia (zod)           | ✅   | zod schémy na vstupoch actions/formulárov.                                                                             |
| Rate limiting                   | ✅   | Upstash Redis (shared) + in-memory fallback (`security/rate-limit.ts`); testované.                                     |
| Secrets mimo klienta            | ✅   | `grep .next/static` na `sk_live`/`SUPABASE_SERVICE_ROLE`/`RESEND_API_KEY`/`UPSTASH_*` → prázdne (2026-07-05).          |
| `.env*` v `.gitignore`          | ✅   | `.gitignore:34` `.env*`; tracked je len `.env.example` (template).                                                     |
| Secrets v git histórii          | ✅   | `git log -S "sk_live"` → jediná zhoda je text v `SYNAPSE-MASTER-PROMPT-v2.md` (príklad grep patternu), nie živý kľúč.  |
| XSS / `dangerouslySetInnerHTML` | ✅   | `grep -rn dangerouslySetInnerHTML src` → 0 výskytov.                                                                   |
| IDOR                            | ✅\* | RLS org-scoping; potvrdiť §6B na deployi (`scripts/pentest.sh`).                                                       |
| `pnpm audit` high/critical      | ✅   | 0 high/critical. 1 moderate: `postcss <8.5.10` (tranzitívne cez `next`, build-time) — sledovať, rieši sa updatom Next. |

Legenda: ✅ splnené · ⚠️ čiastočné · ⏳ čaká na Fázu D · ✅\* pravdepodobne OK, treba live dôkaz.

## §6B Mini-pentest — čaká na nasadené preview

Plný beh vyžaduje nasadené preview (hosted Supabase — akcia používateľa). Skript
je hotový: `scripts/pentest.sh` (spusti `BASE_URL=… bash scripts/pentest.sh`).
Do produkcie: **akýkoľvek FAIL = deploy blokovaný.**

| #   | Test                                | Očakávanie       | Výsledok | PASS/FAIL |
| --- | ----------------------------------- | ---------------- | -------- | --------- |
| 1   | API endpoint bez auth tokenu        | 401/403          | —        | ⏳        |
| 2   | IDOR (cudzie ID s vlastným tokenom) | 403/404          | —        | ⏳        |
| 3   | RLS cez anon key na cudzích dátach  | prázdny výsledok | —        | ⏳        |
| 4   | `/.env`, `/.git/config`             | 404              | —        | ⏳        |

## Automatizované RLS testy

`supabase/tests/rls.sql` (pgTAP) — overuje izoláciu tenantov (člen firmy B nevidí
doklad firmy A) a owner-guard (admin nemôže degradovať/zmazať/povýšiť na ownera).
Spustenie: `pnpm db:start && pnpm db:test`.
**Stav: NAPÍSANÉ, zatiaľ NESPUSTENÉ** (Docker nebežal) → PREDPOKLAD, nie dôkaz.

## História

- 2026-07-05 (Fáza C): pridané action-logic testy (billing gate — vrátane
  fail-closed vetiev; reminder level) a RLS pgTAP skript (čaká na spustenie).
- 2026-07-05: Súbor vytvorený (Fáza A). Checklist naplnený zo statického auditu;
  §6B a runtime overenia naplánované do Fázy D.
