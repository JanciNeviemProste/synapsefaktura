---
description: Write a handoff note when stopping work mid-task, ending the day, or passing something to the other developer. Captures state so the next session does not start by guessing.
argument-hint: "[komu / prečo končím]"
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
model: sonnet
disable-model-invocation: false
---

Context: $ARGUMENTS

The failure this prevents: tomorrow-you, or the other developer, reconstructs from a diff what you
already knew — and reconstructs it slightly wrong.

### 1. Snapshot

```bash
git status --porcelain
git diff --stat origin/main...HEAD
git log --oneline origin/main..HEAD
git stash list
```

### 2. Write `specs/<slug>.handoff.md`

```markdown
# Handoff — <slug>

<dátum> · @<dev> → @<dev|sebe zajtra>

## Kde to je

Vetva `<branch>`, <n> commitov, <n> súborov / <n> riadkov.
Posledné, čo funguje: <commit sha + čo v ňom beží>

## Hotové

- ...

## Rozrobené — presne kde som prestal

<file:line a čo tam malo prísť ďalej>

## Ďalší krok

<one concrete action, not "pokračovať">

## Čo som skúsil a nefungovalo

<the most valuable section — it is what stops the next session repeating a dead end>

- skúsil som X → zlyhalo na Y → preto som šiel cez Z

## Na čo si dať pozor

- ...

## Blokované na

- <čo potrebujem od koho, alebo "nič">

## Ako to spustiť

<commands, seed data, env vars needed — anything not obvious from the repo>
```

Facts only, in the "what I tried" section especially: the command you ran, what you expected, what
you actually got, the exact error. Not your theory about the cause — a confident wrong diagnosis
costs the next session more than no diagnosis.

### 3. Leave the tree clean

Commit as WIP or stash with a named message. Nothing uncommitted and unexplained.
Push the branch so the other developer can see it exists.

### 4. Update the board

`specs/INDEX.md` → 🔴 if blocked, 🟡 if paused. Add one line on why in the notes column.

### 5. If it goes to the other developer

Also add, at the top: the three files he needs to read first, and the one thing he will get wrong if
nobody tells him.
