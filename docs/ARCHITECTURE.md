# Architektúra

Mapa, aby agent vedel, kam siahnuť. Nie referenčná dokumentácia.

**Repo je vrstvené, nie modulárne.** Neexistuje `src/modules/`. Jedna funkcia
žije v troch adresároch — preto sa hľadá po doméne, nie po priečinku:

```
src/app/app/(shell)/logbook/    obrazovka
src/components/logbook/         komponenty
src/lib/logbook/                logika
src/app/actions/trips.ts        Server Action (zápis)
```

## Mapa domén

| Doména                                                 | Zodpovednosť                                       | Lane |
| ------------------------------------------------------ | -------------------------------------------------- | ---- |
| `src/lib/documents`                                    | životný cyklus dokladu, položky, stavy             | A    |
| `src/lib/{expenses,import}`                            | výdavky, XLSX/CSV import, OCR bločkov              | A    |
| `src/lib/{bank,matching}`                              | bankové výpisy, párovanie platieb                  | A    |
| `src/lib/logbook`                                      | kniha jázd, vozidlá, tankovania, sadzby            | A    |
| `src/lib/{pdf,qr}`                                     | PDF cez `@react-pdf/renderer`, QR PAY (`bysquare`) | A    |
| `src/lib/{reports,forecast,anomaly}`                   | výkazy, predikcie cashflow, detekcia anomálií      | A    |
| `src/lib/peppol`                                       | UBL 2.1, Peppol BIS 3.0, validácia, príjem         | B    |
| `src/lib/vat`                                          | DPH — sadzby, režimy, kategórie UNCL5305           | B    |
| `src/lib/money.ts`                                     | peňažná matematika a zaokrúhľovanie                | B    |
| `src/lib/{billing,export}`                             | Stripe, limity plánov, exporty pre účtovníkov      | B    |
| `src/lib/{supabase,security,auth,registry,email,jobs}` | prístup k dátam, RLS, RÚZ/VIES, e-maily, cron      | B    |
| `src/lib/{validation,ai,utils.ts}`                     | zod schémy, AI vrstva, utility — **shared zone**   | —    |

## Multi-tenancy — invariant celého produktu

Každá tabuľka je org-scoped cez `organization_members` + **RLS**. Databáza to
vynucuje sama — okrem jedného prípadu:

**`createAdminClient()` (`src/lib/supabase/admin.ts`) beží pod service role a
RLS obchádza.** Všade, kde sa použije, musí príslušnosť k organizácii overiť
kód: `getCurrentOrgId()`, `belongsToOrg()`, alebo cesta v úložisku musí začínať
`${orgId}/`. Je to v ~14 súboroch a je to najcitlivejšia plocha v repe.

Vstupné body bez session (cron, Stripe webhook) service role používajú správne —
drží ich `isCronAuthorized()` (fail-closed) a overenie podpisu.

## Tok: vystavenie faktúry

```
UI (Server Component)
  → src/app/actions/documents.ts  (zod validácia + getCurrentOrgId)
  → RPC save_document_with_items  (security definer, EXECUTE len service_role)
      ↳ next_document_number(org, typ, rok)   ← tu vzniká číslo
  → prepočet DPH: src/lib/vat/engine.ts + src/lib/money.ts
  → PDF na požiadanie: /invoices/[id]/pdf/route.tsx
  → e-faktúra: src/lib/peppol/ubl.ts → validate.ts → provider
```

Číslo prideľuje **databáza**, nie aplikácia. RPC je odobraté z `public`, `anon`
aj `authenticated` — inak by si ktokoľvek prihlásený nastavil `total`,
`paid_amount` alebo `status` priamo cez PostgREST.

## Peniaze a DPH

Počíta sa v plávajúcej čiarke, ale **zaokrúhľuje sa deterministicky** na centy
half-up (SK konvencia) na každej hranici riadku a dokladu — takže sa chyba
zaokrúhlenia nekumuluje. DPH sa zaokrúhľuje **po skupinách sadzieb, nie po
riadkoch** (EN 16931).

Sadzby od 1. 1. 2025: **23 / 19 / 5 %**.

`src/lib/money.ts` aj `src/lib/vat/engine.ts` sú testované a v guarde ako
`deny`. Chyba tu znamená zle vystavené faktúry u zákazníkov.

## Externé služby — graceful degradation

Bez kľúča appka **beží**, daná funkcia je vypnutá. Nie pád.

| Služba                 | Prepínač                   | Kde                 | Bez kľúča                       |
| ---------------------- | -------------------------- | ------------------- | ------------------------------- |
| AI (OpenRouter/Gemini) | `hasAiKey`                 | `src/lib/ai/`       | AI funkcie skryté               |
| Stripe                 | `hasStripe`                | `src/lib/billing/`  | billing skrytý                  |
| Resend                 | `hasEmail`                 | `src/lib/email/`    | e-maily sa neposielajú          |
| Upstash Redis          | —                          | rate limit          | limit v pamäti procesu          |
| Peppol                 | provider interface         | `src/lib/peppol/`   | **mock (loopback)** — nie ostrý |
| Supabase               | `supabaseEnv().configured` | `src/lib/supabase/` | fail-open Edge guard            |

## Background jobs

Vercel cron → `src/app/api/cron/*`, každý chránený `isCronAuthorized()`
(`CRON_SECRET`, fail-closed).

| Cesta                    | Kedy               | Čo                           |
| ------------------------ | ------------------ | ---------------------------- |
| `/api/cron/overdue`      | denne 05:00        | označí faktúry po splatnosti |
| `/api/cron/recurring`    | denne 06:00        | vystaví opakované doklady    |
| `/api/cron/reminders`    | denne 08:00        | pošle upomienky              |
| `/api/cron/peppol`       | každé 4 h          | príjem e-faktúr              |
| `/api/cron/travel-rates` | 1. v mesiaci 04:00 | aktualizuje sadzby stravného |

`/api/stripe/webhook` overuje podpis cez `stripe.webhooks.constructEvent`.

## Prostredia

|            | URL                         | DB                                           |
| ---------- | --------------------------- | -------------------------------------------- |
| local      | `localhost:3000`            | lokálny Supabase v Dockeri (`pnpm db:start`) |
| preview    | Vercel preview              | **produkčná** — pozor                        |
| production | `synapsefaktura.vercel.app` | Supabase `oukooqfpxeunhdzndsid`              |

Auth konfigurácia produkcie žije v `supabase/config.toml` → `[remotes.production]`,
aplikuje sa cez `supabase config push`. **Nie klikaním v dashboarde** — viď
`docs/AUTH-SETUP.md`.

## Kde to vybuchne

1. **Dve paralelné migrácie.** Obe prejdú lokálne, obe prejdú CI, rozsypú sa až
   pri `supabase db push`. Ohlás sa v `specs/INDEX.md` vopred.
2. **`createAdminClient()` bez org kontroly.** RLS tam nekryje nič. Toto je
   jediná trieda chyby, ktorá znamená únik dát medzi firmami.
3. **Uspatá databáza.** Free tier Supabase uspí projekt po nečinnosti a zhodí
   celý web — preto beží `.github/workflows/supabase-keepalive.yml`.
4. **Zaokrúhľovanie DPH** po riadkoch namiesto po skupinách sadzieb.
5. **Hranice daňových období** — UTC vs. Europe/Bratislava, prelom roka.

<!-- TODO(@JanciNeviemProste): doplniť po každom incidente. -->
