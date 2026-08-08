---
description: Fill the docs templates from the real codebase — replace placeholder paths and FILL IN markers in OWNERSHIP.md, ARCHITECTURE.md, PRODUCT.md and CLAUDE.md with what is actually in the repo. Run once, right after installing this setup.
argument-hint: ""
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
model: opus
disable-model-invocation: true
---

This setup shipped with **assumed** paths and commands. An ownership map that does not match reality
is worse than none — the guard hook silently protects nothing and everybody stops trusting it. Fix
that now.

### 1. Read the repo as it actually is

```bash
git ls-files | head -300
git ls-files | awk -F/ 'NF>1{print $1"/"$2}' | sort | uniq -c | sort -rn | head -40
cat package.json
ls supabase/migrations/ 2>/dev/null && tail -5 $(ls supabase/migrations/*.sql | tail -1)
git log --format='%an' | sort | uniq -c | sort -rn
git log --name-only --format='' --since='6 months ago' | sort | uniq -c | sort -rn | head -40
```

That last one matters: the files that change most often are where conflicts will happen, whatever
the tidy module diagram says.

### 2. Correct `CLAUDE.md`

- Replace the command block with the real scripts from `package.json`
- Replace the stack line with the real versions
- Check every rule under **Non-obvious rules** against the code. Delete any that the code does not
  actually follow — a rule the codebase violates teaches the model to ignore the whole file. If a
  rule _should_ hold but does not yet, move it to `specs/INDEX.md` as work, not to `CLAUDE.md` as fiction.
- Keep the file **under 100 lines**. Anything longer dilutes the instructions that matter; move
  detail into `docs/` and leave a pointer.

### 3. Correct `docs/OWNERSHIP.md` and `.claude/hooks/ownership.json`

Rewrite both tables with real top-level paths. Rules:

- Every path in the repo that is actively developed belongs to exactly one lane, or to `shared`
- Split so the two lanes touch as few of the same files as possible — use the churn data above, not
  the folder names
- Anything both lanes touch weekly is `shared`, not "mostly his"
- The two files must agree **exactly**. Verify by diffing the path lists yourself before you finish.

Then sanity-check the guard:

```bash
echo '{"tool_input":{"file_path":"<a path from the OTHER lane>"}}' \
  | SYNAPSE_DEV=janci node .claude/hooks/guard-paths.mjs
```

Expect `permissionDecision: "ask"`. If you get nothing back, the paths do not match the repo — fix
them, do not move on.

### 4. Write `docs/ARCHITECTURE.md`

From the code, not from imagination: module map (one line each), request flow for issuing an
invoice, the data model in ~10 tables, external integrations, background jobs, and the invariants
that are enforced in code rather than in the schema. Under two pages.

### 5. Write `docs/PRODUCT.md`

If `@JanciNeviemProste`'s master build spec exists in the repo, use it as the source. If it does not, write what
you can support from the code and mark the rest `<!-- TODO: @JanciNeviemProste -->`. **Do not invent product
strategy** — a confident fabrication here propagates into every future session.

### 6. Seed `docs/adr/`

Find the decisions already made and visible in the code, and write them up retroactively — money as
`Decimal`, the tenancy strategy, the numbering approach, the PDF pipeline, the Peppol integration
shape. Mark them `Status: Accepted (retroactive)`. Five good retroactive ADRs are worth more than
twenty aspirational ones.

### 7. Report

What you changed, what you could not determine and why, and the exact list of open `TODO` markers a
human has to close.
