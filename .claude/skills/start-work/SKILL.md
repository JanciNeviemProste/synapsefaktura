---
description: Start a new piece of work the safe way — collision check, lane check, plan, claim. Use at the beginning of any feature or non-trivial fix.
argument-hint: "<čo ideme robiť>"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent, WebFetch
model: opus
disable-model-invocation: false
---

Work to start: **$ARGUMENTS**

Do these in order. **Do not write any implementation code in this skill** — it ends with an approved
plan, not with an edit.

### 1. Orient

Read `docs/OWNERSHIP.md`, `specs/INDEX.md`, and whichever of `docs/PRODUCT.md`,
`docs/ARCHITECTURE.md` and `docs/adr/` are relevant to this task. Skip the ones that are not —
reading everything is not thoroughness, it is context waste.

State in one line: which lane this belongs to, and whether that is the lane of the person at the
keyboard. If it is not, stop here and say so.

### 2. Collision check

Launch the `conflict-scout` agent. If it comes back `medium` or `high`, resolve that first —
usually by talking to the other developer, sometimes by narrowing the scope. Do not plan around a
known collision.

### 3. Branch

```bash
git fetch origin --quiet
git switch -c <type>/<lane>-<short-slug> origin/main
```

`<type>` = `feat` | `fix` | `chore` | `refactor`. `<lane>` = `inv` | `plat`.
Example: `feat/inv-peppol-credit-note`.

For a second parallel lane use a worktree instead so the two never touch:
`claude --worktree <slug>`.

### 4. Plan

Write a plan with, and only with:

- **Goal** — one sentence, in terms of what the user of the product can do afterwards
- **Files** — every path you will touch, each marked `own lane` / `shared` / `other lane`
- **Steps** — each with the test that fails today and passes after
- **Out of scope** — what you are deliberately not doing
- **Size** — file count and rough line count. Over 5 files or ~300 lines, split it here, not later.
- **Contracts needed** — anything you need from the other lane, as an exact type or endpoint signature

Save it to `specs/<slug>.md`.

### 5. Get the plan reviewed

Launch the `plan-reviewer` agent on it. Apply the `Must change` items. If the verdict is `REWORK`,
rewrite and re-run — do not argue your way past it.

### 6. Claim

Add a row to `specs/INDEX.md`:

```
| 🟡 | <slug> | @<dev> | <lane> | <top-level paths claimed> | <YYYY-MM-DD> | <čo potrebujem od druhého> |
```

Commit just that row and push it. **The claim lands before the code**, so the other developer's
session sees it from their next `SessionStart`.

### 7. Hand back

Report the plan, the review verdict, the branch name and the claim row. Then stop and wait for a
go-ahead. The human decides when implementation starts.
