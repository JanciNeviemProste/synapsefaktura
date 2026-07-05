# SECURITY — Synapse Faktúra

Stav bezpečnostného checklistu (Master Prompt v2 §6A) + výsledky mini-pentestu
(§6B). Aktualizovať pri každej fáze so security dopadom.

## §6A Checklist — stav k 2026-07-05

| Oblasť | Stav | Dôkaz / Poznámka |
| --- | --- | --- |
| RLS na každej tabuľke | ✅ | Každá dátová migrácia `enable row level security` + policies (org-scoped cez `organization_members`). |
| Owner-escalation guard | ✅ | `20260625140000_member_role_guard.sql` (USING+WITH CHECK `role <> 'owner'`). |
| Server-side auth check | ✅ | Server Actions overujú org cez `getCurrentOrgId`/RLS; `(shell)` layout guard. |
| Input validácia (zod) | ✅ | zod schémy na vstupoch actions/formulárov. |
| Rate limiting | ⚠️ | in-memory (`security/rate-limit.ts`) → Fáza D: Upstash + fallback. |
| Secrets mimo klienta | ⏳ | Overiť po builde (Fáza D `grep .next/static`). |
| `.env*` v `.gitignore` | ⏳ | Overiť (Fáza D). |
| Secrets v git histórii | ⏳ | `git log -S "sk_live"` (Fáza D). |
| XSS / `dangerouslySetInnerHTML` | ⏳ | Audit (Fáza D). |
| IDOR | ✅* | RLS org-scoping; potvrdiť §6B na deployi. |
| `pnpm audit` high/critical | ⏳ | Fáza D. |

Legenda: ✅ splnené · ⚠️ čiastočné · ⏳ čaká na Fázu D · ✅\* pravdepodobne OK, treba live dôkaz.

## §6B Mini-pentest — čaká na nasadené preview

Plný beh vyžaduje nasadené preview (hosted Supabase — akcia používateľa). Skript:
`scripts/pentest.sh` (Fáza D). Do produkcie: **akýkoľvek FAIL = deploy blokovaný.**

| # | Test | Očakávanie | Výsledok | PASS/FAIL |
| --- | --- | --- | --- | --- |
| 1 | API endpoint bez auth tokenu | 401/403 | — | ⏳ |
| 2 | IDOR (cudzie ID s vlastným tokenom) | 403/404 | — | ⏳ |
| 3 | RLS cez anon key na cudzích dátach | prázdny výsledok | — | ⏳ |
| 4 | `/.env`, `/.git/config` | 404 | — | ⏳ |

## História

- 2026-07-05: Súbor vytvorený (Fáza A). Checklist naplnený zo statického auditu;
  §6B a runtime overenia naplánované do Fázy D.
