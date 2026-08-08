#!/usr/bin/env node
/**
 * PostToolUse hook — Edit | Write
 *
 * Cieľ: zabiť diff noise a type errory pri zdroji. Neformátovaný kód a typové chyby, ktoré
 * prežijú do PR, sú najčastejší dôvod, prečo dva AI diffy kolidujú na riadkoch,
 * ktoré nikto vedome nemenil.
 *
 * 1. Prettier na zmenený súbor (ticho)
 * 2. ESLint --fix na zmenený súbor (ticho)
 * 3. tsc --noEmit na projekt — hlási sa len to, čo je NOVÉ oproti baseline.
 *
 *    Baseline je kľúčová: bez nej hook hlási aj chyby, ktoré tam boli predtým, prípadne
 *    v cudzej lane. Claude ich potom „opravuje", rozšíri diff mimo rozsah a v horšom
 *    prípade sa v tom zacyklí. Baseline sa vytvorí pri prvom behu a ticho sa aktualizuje.
 *
 * Zlyháva otvorene: keď nástroj chýba alebo sa niečo pokazí, hook mlčí a pustí prácu ďalej.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { resolve, relative, sep, dirname, extname } from "node:path"

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const TS_CHECK = process.env.SYNAPSE_HOOK_TSC !== "0" // vypni: SYNAPSE_HOOK_TSC=0
const BASELINE = resolve(PROJECT_DIR, ".claude/.cache/tsc-baseline.json")

let payload = {}
try {
  payload = JSON.parse(readFileSync(0, "utf8") || "{}")
} catch {
  process.exit(0)
}

const ti = payload.tool_input || payload.toolInput || {}
const rawPath = ti.file_path || ti.filePath || ti.path || ""
if (!rawPath) process.exit(0)

let rel
try {
  rel = relative(PROJECT_DIR, resolve(PROJECT_DIR, rawPath))
    .split(sep)
    .join("/")
} catch {
  process.exit(0)
}
if (rel.startsWith("..") || rel.includes("node_modules/")) process.exit(0)

const ext = extname(rel)
const FORMATTABLE = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
]
const LINTABLE = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
const TYPED = [".ts", ".tsx"]
if (!FORMATTABLE.includes(ext)) process.exit(0)

const npx = process.platform === "win32" ? "npx.cmd" : "npx"
const run = (args, timeout = 90_000) => {
  try {
    return {
      ok: true,
      out: execFileSync(npx, args, {
        cwd: PROJECT_DIR,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout,
      }),
    }
  } catch (e) {
    return { ok: false, out: `${e.stdout || ""}${e.stderr || ""}` }
  }
}

// --- 1 + 2: formát a lint, ticho ---------------------------------------
run(
  ["--no-install", "prettier", "--write", "--log-level", "error", rel],
  30_000,
)
if (LINTABLE.includes(ext))
  run(["--no-install", "eslint", "--fix", "--quiet", rel], 60_000)

// --- 3: typecheck s baseline -------------------------------------------
if (!TS_CHECK || !TYPED.includes(ext)) process.exit(0)

const tsc = run(
  ["--no-install", "tsc", "--noEmit", "--pretty", "false"],
  180_000,
)

// Parsuj na signatúry "súbor(riadok,stĺpec): error TSxxxx: text".
// Do signatúry ide súbor + kód + text, NIE riadok — inak posun o riadok vyzerá ako nová chyba.
const errors = (tsc.out || "")
  .split("\n")
  .map((l) => /^(.+?)\((\d+),(\d+)\): (error TS\d+: .*)$/.exec(l.trim()))
  .filter(Boolean)
  .map((m) => ({
    file: m[1].split(sep).join("/"),
    line: m[2],
    sig: `${m[1].split(sep).join("/")}|${m[4]}`,
    text: `${m[1]}(${m[2]},${m[3]}): ${m[4]}`,
  }))

const saveBaseline = (list) => {
  try {
    mkdirSync(dirname(BASELINE), { recursive: true })
    writeFileSync(BASELINE, JSON.stringify({ sigs: list.map((e) => e.sig) }))
  } catch {}
}

// tsc sa nespustil vôbec (nie je nainštalovaný / zlá konfigurácia) → ticho
if (!tsc.ok && errors.length === 0) process.exit(0)

let prev = null
if (existsSync(BASELINE)) {
  try {
    prev = new Set(JSON.parse(readFileSync(BASELINE, "utf8")).sigs || [])
  } catch {}
}

// Prvý beh: len si zapamätaj stav a mlč. Existujúci dlh nie je vec tejto zmeny.
if (!prev) {
  saveBaseline(errors)
  process.exit(0)
}

const fresh = errors.filter((e) => !prev.has(e.sig))
saveBaseline(errors)

if (fresh.length === 0) process.exit(0)

const mine = fresh.filter((e) => e.file === rel || e.file.endsWith("/" + rel))
const others = fresh.filter((e) => !mine.includes(e))
const shown = [...mine, ...others].slice(0, 12)

// exit 2 => stderr ide späť Claudovi ako feedback a opraví to hneď, nie až v CI
process.stderr.write(
  `Tvoja zmena v ${rel} pridala ${fresh.length} ${fresh.length === 1 ? "novú typovú chybu" : "nových typových chýb"}` +
    (others.length ? ` (z toho ${others.length} v iných súboroch).` : ".") +
    `\nOprav ich teraz. Neriešiť ich cez \`as any\`, \`@ts-ignore\` ani úpravou testov.\n` +
    `Ak niektorá je v cudzej lane, needituj ju — nahlás to človeku.\n\n` +
    shown.map((e) => e.text).join("\n") +
    (fresh.length > shown.length
      ? `\n… a ďalších ${fresh.length - shown.length}`
      : "") +
    "\n",
)
process.exit(2)
