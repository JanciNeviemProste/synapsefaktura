# Review instructions — Synapse Faktúra

<!--
POZOR — kedy tento súbor NIEČO robí:

  ✅ Managed Code Review (GitHub App, Team/Enterprise plán) — obsah sa vkladá do system promptu
     každého review agenta ako najvyššia priorita.
  ❌ Lokálny `/code-review` — tento súbor NEČÍTA. Riadi sa iba CLAUDE.md.

Kým nemáte Team plán s Code Review, pravidlá nižšie vynucuje agent `.claude/agents/diff-auditor.md`,
ktorý ich má zapísané priamo v sebe. Keď Code Review zapnete, tento súbor sa aktivuje sám.
Keď meníte pravidlá, zmeňte ich na oboch miestach.

Import syntax `@subor.md` sa tu NEexpanduje — súbor sa vkladá doslovne.
-->

Two developers, both AI-assisted, one production invoicing product. The reviewer's job is to protect
the customer's tax filing and the partner's attention. Nothing else.

## Severity

**Important** is reserved for findings that would break behaviour, corrupt or leak data, produce a
legally invalid invoice, or block a rollback. Everything else is a nit. Do not inflate severity to
make a review look thorough.

Treat as **Important** without hesitation:

- a `createAdminClient()` call without an org check — service role bypasses RLS, cross-tenant data
- money as `number`, or rounded more than once
- invoice numbering regenerated, renumbered, reused, or made non-gapless
- an issued or transmitted document mutated in place instead of corrected by a new document
- UBL / Peppol output changed with no validator evidence in the PR
- a test modified in the same change as the code it covers, in a way that makes a failing test pass
- a new `as any`, `@ts-ignore`, `eslint-disable`, or a swallowed `catch {}` on an error path
- auth, session, or webhook signature verification touched at all

## Do not report

- formatting, import order, naming style, docblocks — CI and the format hook own these
- generated files, lockfiles, `supabase/migrations/**`, `src/lib/supabase/database.types.ts`, vendored code
- pre-existing issues the PR did not touch, unless the PR makes them materially worse
- suggestions to add abstraction, defensive layers, or tests for cases that cannot occur
- anything already enforced by `pnpm typecheck` or `pnpm lint`

## Evidence bar

A claim about behaviour needs a `file:line` citation in the source. Inferring from a function name
is not a citation. If you cannot cite it, do not report it — a false positive costs the author a
round trip and costs the reviewer their credibility.

## Volume

At most **five** nits per review. Mention the rest as a count in the summary. On re-review, post
Important findings only and suppress new nits entirely — a one-line fix must not reach round seven
over style.

## Scope

Flag anything outside the stated scope of the PR: renames, reformatted untouched lines, opportunistic
refactors, new dependencies, new abstractions nobody asked for. In this repo scope creep is a
correctness concern, not a taste one — it is what makes a two-person review expensive and it is what
makes two branches conflict.

Also flag: more than 5 files or ~300 changed lines, and any file that falls outside the author's lane
per `docs/OWNERSHIP.md` or into the shared zone.

## Summary shape

Lead with a tally: `2 important, 3 nits (7 suppressed)`. Then the findings, most severe first.
No praise section.
