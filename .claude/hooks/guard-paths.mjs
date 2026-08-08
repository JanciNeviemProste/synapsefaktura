#!/usr/bin/env node
/**
 * PreToolUse hook — Edit | Write | NotebookEdit
 *
 * Tri vrstvy ochrany:
 *   1. blocked         -> deny  (migrácie, secrets, auth/session, platobné webhooky, CI)
 *   2. cudzia lane     -> ask   (patrí druhému vývojárovi)
 *   3. confirmRequired -> ask   (shared zone s vysokým rizikom konfliktu, napr. supabase/migrations/)
 *
 * Vracia exit 0 + JSON s permissionDecision. Pri akejkoľvek internej chybe hook
 * zlyhá "otvorene" (nechá zápis prejsť) — guardrail nesmie zablokovať prácu kvôli sebe.
 */

import { readFileSync } from "node:fs"
import { resolve, relative, sep } from "node:path"

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const ME = (process.env.SYNAPSE_DEV || "").trim().toLowerCase()

function out(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  )
  process.exit(0)
}

function allow() {
  process.exit(0)
}

let input = ""
try {
  input = readFileSync(0, "utf8")
} catch {
  allow()
}

let payload
try {
  payload = JSON.parse(input || "{}")
} catch {
  allow()
}

const ti = payload.tool_input || payload.toolInput || {}
const rawPath = ti.file_path || ti.filePath || ti.path || ti.notebook_path || ""
if (!rawPath) allow()

// Normalizuj na cestu relatívnu k repu, so slashmi
let rel
try {
  rel = relative(PROJECT_DIR, resolve(PROJECT_DIR, rawPath))
} catch {
  allow()
}
rel = rel.split(sep).join("/")
if (rel.startsWith("..")) allow() // mimo repa — rieši to permissions, nie my

let cfg
try {
  cfg = JSON.parse(
    readFileSync(resolve(PROJECT_DIR, ".claude/hooks/ownership.json"), "utf8"),
  )
} catch {
  allow() // config chýba -> neblokuj
}

const hit = (pattern) => rel === pattern || rel.startsWith(pattern)
// dotfiles ako .env chytáme aj vnorene (apps/web/.env), nielen v koreni
const base = rel.split("/").pop()
const hitDeep = (pattern) =>
  hit(pattern) ||
  (pattern.startsWith(".") &&
    (base === pattern || base.startsWith(pattern + ".")))

// --- 1. blocked ---------------------------------------------------------
for (const rule of cfg.blocked || []) {
  if (!hitDeep(rule.pattern)) continue
  if (ME && Array.isArray(rule.allowFor) && rule.allowFor.includes(ME)) continue
  out(
    "deny",
    `[guard] ${rel} je chránená cesta.\n${rule.reason}\nAk to naozaj treba, povedz to človeku — nerob to sám.`,
  )
}

// --- 2. cudzia lane -----------------------------------------------------
const lanes = cfg.lanes || {}
const owner = Object.keys(lanes).find((dev) =>
  (lanes[dev] || []).some((p) => hit(p)),
)

if (owner && ME && owner !== ME) {
  out(
    "ask",
    `[guard] ${rel} patrí do lane @${owner}, ty si @${ME}.\n` +
      `Podľa docs/OWNERSHIP.md sa cudzia lane needituje bez dohody — je to najčastejší zdroj merge konfliktov.\n` +
      `Lepšia cesta: požiadaj @${owner} o kontrakt (typ / endpoint), nie o prístup do jeho súborov.\n` +
      `Ak na to máš súhlas, potvrď a zapíš to do specs/INDEX.md.`,
  )
}

// --- 3. shared zone s vysokým rizikom -----------------------------------
for (const rule of cfg.confirmRequired || []) {
  if (hit(rule.pattern)) {
    out("ask", `[guard] ${rel} je v shared zone.\n${rule.reason}`)
  }
}

allow()
