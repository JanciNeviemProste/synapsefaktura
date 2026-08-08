---
description: Pre-PR gate. Run before opening any pull request — verifies the diff against the plan, checks ownership and size, runs the full check suite, and drafts the PR body.
argument-hint: "[--draft]"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent
model: opus
disable-model-invocation: false
---

Pre-PR gate. Nothing here is optional. If a step fails, fix it and start this skill again from the
top — do not carry a failure forward with a note about it.

### 1. Sync

```bash
git fetch origin --quiet
git rebase origin/main
```

Conflicts here are yours to resolve now, not the reviewer's to resolve later.

### 2. Full check suite — real output required

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Paste the actual output. A statement that it passed is not evidence that it passed. If any of these
does not exist in `package.json`, say which and run the closest equivalent.

### 3. Self-review

Run `/code-review high` on the branch diff and address what it finds. Doing this yourself is the
cheapest courtesy in a two-person team: it removes the entire class of "you made your partner read
something you had not read yourself".

### 4. Independent audit

Launch the `diff-auditor` agent. Everything under `BLOCKING` gets fixed before the PR opens. If the
change touched `src/lib/peppol`, `src/lib/vat` or `src/lib/export`, also launch
`einvoice-expert` on the diff.

### 5. Size gate

```bash
git diff --shortstat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Over 5 files or ~300 changed lines: stop and propose the split. Conflict probability roughly triples
between a small PR and a medium one, and your partner reviews with one pair of eyes, not four.
Excess is only acceptable when the human explicitly says so, and then the PR body says why.

### 6. ADR check

Did this change introduce a new pattern, a new dependency, a new module boundary, or overturn how
something was previously done? Then this PR ships an ADR — run `/adr` now. Small changes are exactly
how architectural drift accumulates, so there is no small-change exemption.

### 7. Ownership check

Every changed path against `docs/OWNERSHIP.md`. Anything in the other lane or in the shared zone
gets extracted into its own PR that merges first. Say so plainly if you find one.

### 8. PR body

Write it to `.git/PR_BODY.md` in this shape:

```markdown
## Čo a prečo

<one paragraph — the user-visible change, not the implementation>

Closes #<issue>

## Ako to otestovať

1. ...

## Dôkaz

<paste: typecheck / lint / test / build output>

## Lane

Lane: <A/B> · súbory: <n> · riadky: <n> · shared zone: nie / <ktoré>

## Riziko

<what breaks if this is wrong, and how we roll back>

## Všimol som si, neopravoval som

- ...
```

### 9. Open it

```bash
gh pr create --fill-first --body-file .git/PR_BODY.md --assignee @me --reviewer <ten druhý>
```

Add `--draft` if `$ARGUMENTS` contains `--draft`.

### 10. Close the claim

Set the row in `specs/INDEX.md` to 🔵 with the PR number.

Finish with a short report: checks green, findings fixed, PR link, size. No victory lap.
