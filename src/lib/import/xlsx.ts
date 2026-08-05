import "server-only"

import readXlsxFile from "read-excel-file/node"
import { normalizeHeader, type ParsedTable } from "@/lib/import/table"

/**
 * Čítanie zošita Excelu (.xlsx) na riadky.
 *
 * Zámerne `read-excel-file` a nie `xlsx` (SheetJS): verzia SheetJS na npm je
 * 0.18.5 so známymi zraniteľnosťami (prototype pollution, ReDoS) a opravené
 * verzie sa distribuujú mimo npm, čo sa do verejného repozitára nehodí.
 * `read-excel-file` je navyše len čítačka — menšia plocha na útok.
 *
 * `server-only`: XLSX je ZIP a rozbaľuje sa z používateľského súboru. Do
 * prehliadača to nemá čo robiť.
 */

/** Nad toľko riadkov import odmietneme — chráni pred zip bombou aj preklepom. */
const MAX_ROWS = 20_000

/**
 * Bunka na text.
 *
 * `read-excel-file` vracia podľa obsahu `string`, `number`, `Date` aj
 * `boolean`. Import pracuje s textom, takže sa to zjednotí tu — a `Date` sa
 * NEformátuje cez locale, aby z „12345678" v IČO nevzniklo „12 345 678".
 */
function cellToText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number") {
    // Excel drzi cisla ako float. IČO „12345678" tak pride ako 12345678
    // a `String()` z neho spravi spravny text bez oddelovacov tisicov.
    return Number.isInteger(value) ? String(value) : String(value)
  }
  return String(value).trim()
}

/**
 * Prečíta PRVÝ hárok zošita a vráti hlavičku a riadky v rovnakom tvare,
 * aký dáva CSV parser — aby na oboch stranách bežal ten istý mapovací kód.
 */
export async function xlsxToTable(buffer: Buffer): Promise<ParsedTable> {
  // `read-excel-file` vracia POLE HAROV (`[{ sheet, data }]`), nie priamo
  // riadky. Berieme prvy harok — pouzivatel nahrava tabulku klientov, nie
  // zosit s viacerymi listami, a hadat, ktory z nich myslel, by bolo horsie
  // nez pouzit ten prvy.
  const parsed = (await readXlsxFile(buffer)) as unknown
  const sheets = Array.isArray(parsed) ? parsed : []
  const first = sheets[0] as { data?: unknown[][] } | unknown[] | undefined

  const raw: unknown[][] = Array.isArray(first)
    ? (first as unknown[][])
    : ((first?.data ?? []) as unknown[][])

  if (raw.length === 0) return { header: [], rows: [] }

  const header = (raw[0] ?? []).map((c) => normalizeHeader(cellToText(c)))
  const rows = raw.slice(1, MAX_ROWS + 1).map((row) => {
    const cells = row.map(cellToText)
    while (cells.length < header.length) cells.push("")
    return cells
  })
  return { header, rows }
}

/** Rozpozná zošit Excelu podľa magických bajtov — .xlsx je ZIP, teda `PK`. */
export function looksLikeXlsx(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}
