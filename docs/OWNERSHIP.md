# Ownership map

**Prečo:** dvaja ľudia s agentmi generujú veľké diffy rýchlo. Jediná vec, ktorá
merge konflikty spoľahlivo vypína, je **jeden súbor = jeden vlastník**.

Pravidlo: **needituj cudziu lane bez explicitného súhlasu.** Hook
`.claude/hooks/guard-paths.mjs` to kontroluje pri každom zápise a pri cudzej
lane sa opýta.

> Rozdelenie nie je návrh — vzniklo **z git churnu po autoroch** (2026-08-08).
> Zdôvodnenie je na konci súboru.

---

## Lane A — Doklady a prevádzka → **@csrom**

Čo Roman reálne stavia: obrazovky, formuláre, doklady, výdavky, kniha jázd, banka.

| Cesta                                                                                                  | Obsah                                              |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `src/app/app/`                                                                                         | celá chránená oblasť — dashboard, faktúry, výdavky |
| `src/app/actions/`                                                                                     | Server Actions (okrem `auth.ts`, viď Lane B)       |
| `src/components/`                                                                                      | komponenty funkcií (okrem `ui/`, viď shared)       |
| `src/lib/{documents,expenses,logbook,import,bank,matching,pdf,reports,cash,stock,recurring,contacts}/` | doménová logika dokladov a prevádzky               |
| `src/lib/{upload,storage,images,qr}/`                                                                  | nahrávanie, úložisko, QR PAY                       |
| `supabase/migrations/`                                                                                 | schéma databázy                                    |
| `messages/`                                                                                            | preklady                                           |

## Lane B — Platforma a čo sa nesmie pokaziť → **@JanciNeviemProste**

Peniaze, dane, prístupy, nasadenie, marketing.

| Cesta                                                          | Obsah                                          |
| -------------------------------------------------------------- | ---------------------------------------------- |
| `src/lib/{peppol,vat}/`                                        | e-faktúra UBL 2.1, DPH — legislatíva           |
| `src/lib/{billing,export}/`                                    | predplatné, limity, exporty pre účtovníkov     |
| `src/lib/{supabase,security,auth,registry,email,jobs}/`        | prístup k dátam, RLS, cron, RÚZ/VIES, e-maily  |
| `src/lib/money.ts`, `src/lib/site.ts`, `src/lib/landing/`      | peňažná matematika, firemné údaje, landing     |
| `src/middleware.ts`, `src/app/actions/auth.ts`, `src/app/api/` | Edge guard, prihlásenie, cron a Stripe webhook |
| `.github/`, `marketing/`, `docs/`                              | CI, marketing, dokumentácia                    |

---

## Shared zone — nikto nevlastní, obaja opatrne

`src/components/ui/` (shadcn primitívy) · `src/lib/validation/` · `src/lib/ai/` ·
`src/lib/utils.ts` · `src/app/layout.tsx` · `src/app/globals.css` ·
`package.json` · `tsconfig.json` · `CLAUDE.md` · `.claude/`

Nie sú tu z lenivosti. Sú tu preto, že v churne ich **naozaj menia obaja** —
`src/lib/validation/` má 36 zmien naprieč všetkými autormi, `src/components/ui/`
19 od jedného a 11 od druhého.

Pravidlá pre shared zone:

1. **Ohlás vopred** v `specs/INDEX.md` **predtým**, ako začneš. Nie po.
2. **Chirurgicky.** Pridaj, needituj. Nový súbor > zmena existujúceho.
3. **Nikdy nie vo feature PR.** Zmena v shared zone ide vo vlastnej malej PR,
   ktorá sa mergne prvá.

---

## Zakázané pre agenta (guard vráti `deny`)

| Cesta                            | Prečo                                                     |
| -------------------------------- | --------------------------------------------------------- |
| `.env*`                          | secrets — povedz človeku, čo doplniť                      |
| `src/lib/vat/engine.ts`          | výpočet DPH, testovaný; chyba = zle vystavené faktúry     |
| `src/lib/money.ts`               | peňažná matematika a zaokrúhľovanie, testované            |
| `src/lib/peppol/ubl.ts`          | generovanie UBL 2.1, testované; štruktúru nemeniť         |
| `src/lib/peppol/validate.ts`     | validácia UBL 2.1, testovaná; štruktúru nemeniť           |
| `src/lib/peppol/inbound.ts`      | príjem e-faktúr, testovaný; štruktúru nemeniť             |
| `src/lib/supabase/middleware.ts` | fail-open Edge guard; zlá zmena zhodí celý web na Verceli |
| `src/app/actions/auth.ts`        | registrácia a prihlásenie (výnimka: `janci`)              |
| `.github/workflows/`             | CI je merge gate (výnimka: `janci`)                       |

## Vyžaduje potvrdenie (guard vráti `ask`)

| Cesta                                | Prečo                                                            |
| ------------------------------------ | ---------------------------------------------------------------- |
| `supabase/migrations/`               | vždy **nový** súbor; existujúcu migráciu má druhý už aplikovanú  |
| `src/lib/supabase/database.types.ts` | generované cez `supabase gen types`, mení sa pri každej migrácii |
| `src/lib/billing/plans.ts`           | ceny a limity — produktové rozhodnutie vlastníka, nie technické  |

---

## Keď potrebuješ cudziu lane

1. Napíš to do `specs/INDEX.md` do stĺpca _Potrebujem_.
2. Napíš druhému. Buď ti to odbliká, alebo tú zmenu spraví sám vo svojej PR.
3. Preferovaná odpoveď je **kontrakt, nie edit**: „daj mi typ alebo endpoint,
   ktorý potrebuješ, ja ho dodám" je lacnejšie než ty v jeho súboroch.

## Cross-cutting zmeny

Importy, registrácia routes, config, i18n kľúče — magnety na konflikty.
**Odlož ich do samostatnej integračnej PR** na konci, nerozsypávaj ich po ceste.

## Keď sa lane presunie

Uprav tento súbor **aj** `.github/CODEOWNERS` **aj** `.claude/hooks/ownership.json`
v jednej PR. Tri miesta, jedna pravda.

---

## Odkiaľ sa to vzalo

Balík, z ktorého tento setup pochádza, predpokladal vertikálne moduly
(`src/modules/invoices/`). **Toto repo je vrstvené** — `app/` × `components/` ×
`lib/` — takže jedna funkcia žije v troch adresároch a delenie musí ísť po
doménach naprieč vrstvami.

Čo ukázal `git log --author=… --name-only` k 2026-08-08 (počet zmien):

| Jasne Romanovo                                                                                                                                        | Jasne vlastníkovo                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `lib/documents` 20 · `lib/logbook` 16 · `lib/expenses` 8 · `lib/pdf` 7 · `lib/import` 6 · `lib/matching` 4 · `components/{logbook,expenses,settings}` | `lib/peppol` 14 · `lib/supabase` 13 · `lib/billing` 7 · `lib/jobs` 7 · `docs/log` 19 |

`src/app/actions` a `src/app/app` má v top 3 **každý autor** — preto je Lane A
široká a shared zóna väčšia, než by sa chcelo. Nie je to nedbalosť, je to stav
kódu.
