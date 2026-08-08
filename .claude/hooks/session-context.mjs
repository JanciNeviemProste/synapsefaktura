#!/usr/bin/env node
/**
 * SessionStart hook
 *
 * Vpichne na začiatku sedenia to, čo Claude inak nemá odkiaľ vedieť:
 *   - kto pri klávesnici sedí (a teda ktorá lane je jeho)
 *   - na akej vetve sme a ako ďaleko od main
 *   - čo si druhý vývojár práve claimol (specs/INDEX.md)
 *   - koľko riadkov už v tejto vetve narástlo (early warning na veľkú PR)
 *
 * Bez tohto Claude začína naslepo a prvé, čo urobí, je hádanie.
 */

import { readFileSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"
import { resolve } from "node:path"

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const ME = (process.env.SYNAPSE_DEV || "").trim().toLowerCase()

const git = (cmd, fallback = "") => {
  try {
    return execSync(`git ${cmd}`, {
      cwd: PROJECT_DIR,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: 8000,
    }).trim()
  } catch {
    return fallback
  }
}

const parts = []

if (ME) {
  parts.push(
    `Pri klávesnici sedí **@${ME}**. Jeho lane je definovaná v \`docs/OWNERSHIP.md\` a vynútená hookom \`guard-paths.mjs\`.`,
  )
} else {
  parts.push(
    `⚠️ \`SYNAPSE_DEV\` nie je nastavené, takže neviem, kto pri klávesnici sedí a ownership guard beží naslepo. ` +
      `Povedz človeku, nech si do \`.claude/settings.local.json\` doplní \`{"env":{"SYNAPSE_DEV":"janci"}}\` (alebo \`roman\`).`,
  )
}

const branch = git("rev-parse --abbrev-ref HEAD", "?")
const base = git("rev-parse --verify --quiet origin/main")
  ? "origin/main"
  : "main"
const ahead = git(`rev-list --count ${base}..HEAD`, "?")
// lockfiles, snapshoty a migrácie do veľkosti nerátame — rovnako ako CI gate
const EXCLUDE =
  "':(exclude)*lock.yaml' ':(exclude)*lock.json' ':(exclude)*.lock' " +
  "':(exclude)*.snap' ':(exclude)supabase/migrations/**' ':(exclude)**/generated/**'"
const stat = git(`diff --shortstat ${base}...HEAD -- . ${EXCLUDE}`, "")
const dirty = git("status --porcelain", "").split("\n").filter(Boolean).length

parts.push(
  `Vetva: \`${branch}\` · ${ahead} commitov pred \`${base}\` · ${dirty} nezacommitovaných súborov` +
    (stat ? `\nDiff voči ${base}: ${stat}` : ""),
)

// Early warning na veľkú PR — konfliktovosť rastie ~3x medzi malou a strednou PR
const m = /(\d+) insertions?\(\+\)(?:, (\d+) deletions?)?/.exec(stat || "")
const churn = m ? Number(m[1] || 0) + Number(m[2] || 0) : 0
const files = Number((/(\d+) files? changed/.exec(stat || "") || [])[1] || 0)
if (churn > 300 || files > 5) {
  parts.push(
    `🔴 Táto vetva je už veľká (${files} súborov, ~${churn} riadkov). Limit je 5 súborov / 300 riadkov. ` +
      `Skôr než pridáš čokoľvek ďalšie, navrhni ako to rozdeliť a ohlás to človeku.`,
  )
}

const indexPath = resolve(PROJECT_DIR, "specs/INDEX.md")
if (existsSync(indexPath)) {
  try {
    const rows = readFileSync(indexPath, "utf8")
      .split("\n")
      .filter((l) => l.trim().startsWith("|") && /🟡|🔵|🔴/.test(l))
    if (rows.length) {
      parts.push(
        `Aktívna práca (specs/INDEX.md) — **needituj to, čo claimol niekto iný**:\n${rows.join("\n")}`,
      )
    }
  } catch {}
}

parts.push(
  `Pripomienka: pri čomkoľvek väčšom než jednosúborová oprava najprv **plán, potom kód**. ` +
    `Pred otvorením PR spusti \`/ship\`.`,
)

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: parts.join("\n\n"),
    },
  }),
)
