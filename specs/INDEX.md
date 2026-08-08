# Active work board

Toto je „kto sa čoho práve dotýka". Je v repe schválne — obidve Claude Code sessions to čítajú
automaticky pri štarte (hook `session-context.mjs`), takže to funguje aj keď si nenapíšeme.

**Claim ide do repa skôr než kód.** Riadok pridaj a pushni hneď po `/start-work`, nie až s PR-kou.

Legenda: 🟡 rozrobené · 🔵 v review · 🔴 blokované · ✅ hotové (presuň dole a po mesiaci zmaž)

| St  | Slug                      | Kto                | Lane | Claimnuté cesty                               | Od         | Potrebujem / pozn.                                                                   |
| --- | ------------------------- | ------------------ | ---- | --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| 🟡  | _príklad-peppol-dobropis_ | @JanciNeviemProste | B    | `src/lib/peppol/`, `src/lib/vat/`             | 2026-08-08 | od @csrom stĺpec `credit_note_ref` v `documents`                                     |
| 🟡  | _príklad-kniha-jazd_      | @csrom             | A    | `src/lib/logbook/`, `src/components/logbook/` | 2026-08-08 | dotknem sa `supabase/migrations/` v stredu — @JanciNeviemProste nech vtedy nemigruje |

Príkladové riadky zmaž, keď pribudne prvý skutočný.

---

## Shared zone kalendár

Kto sa kedy dotkne `supabase/migrations/`, `src/components/ui/`,
`src/lib/validation/`, `src/lib/ai/` alebo `package.json`. Zapíš **vopred**.

Dve paralelné migrácie sú najhorší konflikt, aký v tomto repe vieme vyrobiť —
obe prejdú lokálne, obe prejdú CI, a rozsypú sa až pri `supabase db push` na
produkciu.

| Kedy       | Kto    | Čo                                                   | Hotové? |
| ---------- | ------ | ---------------------------------------------------- | ------- |
| 2026-08-12 | @csrom | `supabase/migrations/` — nová tabuľka pre knihu jázd | ⬜      |

---

## Ako to používať

1. `/start-work <čo>` ti riadok vygeneruje a pushne.
2. Keď otvoríš PR → 🔵 + číslo PR.
3. Keď sa mergne → ✅ a presuň dole.
4. Keď si zablokovaný → 🔴 + jedna veta prečo. Druhý to uvidí pri svojom najbližšom štarte session.

Ak sa dvom prekrývajú claimnuté cesty, **nezačínajte obaja**. Ten druhý buď počká, alebo si vypýta
kontrakt (typ / endpoint), nie prístup do cudzích súborov.
