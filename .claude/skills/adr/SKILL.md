---
description: Record an architecture decision. Use whenever a new pattern, dependency, module boundary or convention is introduced, or an old one is overturned — the ADR ships in the same PR as the change.
argument-hint: "<rozhodnutie v jednej vete>"
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
model: opus
disable-model-invocation: false
---

Decision: **$ARGUMENTS**

An ADR is not documentation hygiene. It is the only mechanism that stops an agent — yours or his —
from refactoring away a design whose reason exists nowhere in the repo. Without it, a sequence of
individually reasonable PRs slowly reintroduces bugs the original design was written to avoid.

### 1. Check it is not already decided

```bash
ls docs/adr/
rg -i "<key terms>" docs/adr/
```

If an ADR already covers this: either this change fits it (no new ADR needed — say so), or it
supersedes it (write the new one and mark the old `Superseded by NNNN`). **Never delete an ADR.**
The road not taken is information.

### 2. Write it

Next number, zero-padded: `docs/adr/NNNN-kebab-title.md`. Copy `docs/adr/TEMPLATE.md`.

Rules that make ADRs actually useful to an agent later:

- **Context is the part that matters.** What forced the decision — the constraint, the deadline, the
  legal requirement, the thing that broke. Six months from now the constraint is invisible and only
  the code remains; this section is the whole point of the file.
- **Decision in one or two active-voice sentences.** "Peniaze držíme v centoch ako integer (`src/lib/money.ts`)", not
  "it was decided that money should probably be stored as…".
- **Consequences, both directions.** What gets easier and what gets harder. An ADR with only upsides
  was not a decision, it was a preference.
- **Alternatives considered, with why not.** This is what stops the next agent from re-proposing the
  option you already rejected.
- Keep it under one page. Long ADRs do not get read, by humans or by models.

### 3. Wire it in

- Add the row to `docs/adr/README.md`
- If the decision changes a rule Claude must follow every session, add **one line** to `CLAUDE.md`
  pointing at the ADR — not the reasoning, just the rule and the pointer
- Stage it into the **same commit and same PR** as the code it describes

### 4. Report

Path, number, title, and the one-line rule you added to `CLAUDE.md` if any.
