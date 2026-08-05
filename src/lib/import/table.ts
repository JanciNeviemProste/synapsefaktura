/**
 * Čítanie tabuľky z CSV (čisté, bez I/O).
 *
 * Vytiahnuté z `lib/bank/csv-import.ts`, aby import klientov nemal vlastnú
 * kópiu tých istých pravidiel. Bankový import ich používa naďalej.
 *
 * Rieši to, na čom taký import reálne zlyháva:
 * - oddeľovač `;` (slovenský Excel), `,` (medzinárodný) aj tabulátor,
 * - úvodzovky a zdvojené `""` vnútri hodnoty,
 * - hlavičky s diakritikou a rôznou veľkosťou písmen,
 * - BOM na začiatku súboru, ktorý by inak skryl prvý stĺpec.
 */

/** Odstráni diakritiku — „Názov" a „Nazov" má byť tá istá hlavička. */
export function deburr(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

/** Porovnávací tvar hlavičky: bez diakritiky, malé písmená, bez okrajov. */
export function normalizeHeader(s: string): string {
  return deburr(s).toLowerCase().trim()
}

/** Rozdelí jeden riadok CSV a rešpektuje pritom úvodzovky. */
export function splitLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === delim && !inQuotes) {
      out.push(cur)
      cur = ""
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((v) => v.trim())
}

/** Oddeľovač podľa toho, ktorý sa v hlavičke vyskytuje najčastejšie. */
export function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  const tabs = (headerLine.match(/\t/g) ?? []).length
  if (tabs >= semis && tabs >= commas) return "\t"
  return semis >= commas ? ";" : ","
}

export interface ParsedTable {
  /** Hlavičky v normalizovanom tvare. */
  header: string[]
  /** Dátové riadky; každý má rovnakú dĺžku ako `header`. */
  rows: string[][]
}

/**
 * Rozparsuje obsah CSV na hlavičku a riadky.
 *
 * Prázdne riadky sa preskočia — v exporte z Excelu ich býva na konci viac.
 * Kratší riadok sa doplní prázdnymi hodnotami, aby index stĺpca vždy sedel.
 */
export function parseTable(content: string): ParsedTable {
  // BOM by sa inak stal súčasťou prvej hlavičky a stĺpec by sa nenašiel.
  const text = content.replace(/^﻿/, "")
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "")
  if (lines.length === 0) return { header: [], rows: [] }

  const delim = detectDelimiter(lines[0])
  const header = splitLine(lines[0], delim).map(normalizeHeader)
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, delim)
    while (cells.length < header.length) cells.push("")
    return cells
  })
  return { header, rows }
}

/**
 * Nájde index stĺpca podľa kľúčových slov v hlavičke.
 *
 * Najprv presná zhoda, potom „obsahuje" — takže „ICO" nájde aj hlavičku
 * „IČO odberateľa". Vráti `-1`, keď stĺpec v tabuľke nie je.
 */
export function findColumn(header: string[], keys: string[]): number {
  const wanted = keys.map(normalizeHeader)
  const exact = header.findIndex((h) => wanted.includes(h))
  if (exact !== -1) return exact
  return header.findIndex((h) => wanted.some((k) => h.includes(k)))
}
