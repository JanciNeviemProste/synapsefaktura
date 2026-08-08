---
description: Onboard a developer onto Synapse Faktúra — teach the product, the domain and the codebase in a guided walkthrough. Use on a new developer's first sessions, or when returning to an unfamiliar module.
argument-hint: "[modul alebo oblasť, napr. peppol]"
allowed-tools: Read, Grep, Glob, Bash, WebFetch, WebSearch
model: opus
disable-model-invocation: true
---

Focus: **$ARGUMENTS** — if that is empty, cover the whole product.

You are onboarding a **senior developer**. He does not need TypeScript explained. He needs the two
things a codebase never tells you by reading it: **why it is shaped this way**, and **where the
landmines are**. Optimise ruthlessly for that.

Explore first, then teach. Do not lecture from the docs — verify every claim against the actual code
and say when the docs and the code disagree, because that disagreement is itself the most useful
thing you can hand him.

### Explore

Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/adr/`, `CLAUDE.md`, `docs/OWNERSHIP.md`.
Then verify against reality: `supabase/migrations/`, the `src/lib` domain tree, the API routes, the test
suite, the last 50 commits. Where a doc is stale, note it — you will list those at the end.

### Then deliver, in this order

**1. Čo produkt je** — in five sentences. Who pays for it, what they were doing before, why 2027
(mandatory e-invoicing) is the whole business case, and where SuperFaktúra is beaten. If
`docs/PRODUCT.md` cannot support this, say what is missing rather than inventing it.

**2. Doménový slovník** — the ~15 terms he will meet in the first week, each mapped to its code
identifier and its DB table: faktúra, dobropis, ťarchopis, odberateľ, dodávateľ, DPH, DIČ / IČ DPH /
IČO, variabilný symbol, dodanie vs. vystavenie, kontrolný výkaz, Peppol / UBL / BIS 3.0, access
point. He is a developer, not an accountant — this table is what makes the code readable.

**3. Životný cyklus faktúry** — draft → issued → sent → paid → (corrected). Where each transition
lives in the code, what becomes immutable at which point, and what is legally irreversible. This is
the spine of the product; everything else hangs off it.

**4. Dátový model** — the 8–10 tables that matter, their relationships, and the invariants that are
not expressible in the schema (tenant scoping, gapless numbering, append-only issued documents,
`Decimal` money).

**5. Kde to vybuchne** — the real payload. For each: what it is, why it is like that, what happens
if you get it wrong. Start with numbering, tenancy, money rounding, VAT periods, Peppol validation,
and whatever the last 50 commits show as recently painful.

**6. Ako sa tu pracuje** — lane ownership, the plan→review→code→`/ship` loop, the size limits, the
hard stops. Point at `docs/WORKFLOW.md`; do not restate it in full.

**7. Prvé tri úlohy** — three real, small, in-his-lane changes that teach the most per line, ordered
easiest first, each with the files to touch and the test to write. Pick these from actual repo TODOs
or obvious small gaps, not invented exercises.

**8. Kde dokumentácia klame** — every place you found the docs and the code disagreeing. Offer to
fix them.

Ask at the end whether to go deeper on any section. Do not go deeper unasked — this is already long.
