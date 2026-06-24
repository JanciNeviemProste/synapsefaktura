/**
 * Tolerant bank-statement CSV parser. Slovak banks export different layouts, so
 * we detect the delimiter and map columns by header keywords (diacritics-insensitive)
 * rather than fixed positions. Amounts accept SK formatting ("1 234,56").
 */

export interface ParsedTransaction {
  bookedAt: string | null // YYYY-MM-DD
  amount: number
  currency: string
  vs: string | null
  ks: string | null
  ss: string | null
  counterparty: string | null
  message: string | null
  raw: Record<string, string>
}

export interface CsvParseResult {
  transactions: ParsedTransaction[]
  errors: string[]
}

function deburr(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function norm(s: string): string {
  return deburr(s).toLowerCase().trim()
}

/** Split one CSV line honoring quotes. */
function splitLine(line: string, delim: string): string[] {
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

function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  const tabs = (headerLine.match(/\t/g) ?? []).length
  if (tabs >= semis && tabs >= commas) return "\t"
  return semis >= commas ? ";" : ","
}

const COLUMN_KEYS: Record<keyof Omit<ParsedTransaction, "raw">, string[]> = {
  bookedAt: [
    "datum",
    "date",
    "valuta",
    "datum zauctovania",
    "datum splatnosti",
  ],
  amount: ["suma", "amount", "ciastka", "objem", "obrat"],
  currency: ["mena", "currency"],
  vs: ["vs", "variabilny", "variabilny symbol", "variabilnysymbol"],
  ks: ["ks", "konstantny", "konstantny symbol"],
  ss: ["ss", "specificky", "specificky symbol"],
  counterparty: [
    "protistrana",
    "counterparty",
    "partner",
    "nazov protiuctu",
    "ucet protistrany",
    "protiucet",
  ],
  message: ["sprava", "message", "poznamka", "popis", "info", "ucel"],
}

function mapColumns(header: string[]): Partial<Record<string, number>> {
  const map: Partial<Record<string, number>> = {}
  const normalized = header.map(norm)
  for (const [field, keys] of Object.entries(COLUMN_KEYS)) {
    let idx = normalized.findIndex((h) => keys.includes(h))
    if (idx === -1) {
      idx = normalized.findIndex((h) => keys.some((k) => h.includes(k)))
    }
    if (idx !== -1) map[field] = idx
  }
  return map
}

/** Parse SK/intl number: "1 234,56", "-1234.56", "1,234.56". */
export function parseAmount(input: string): number {
  let s = input.replace(/\s/g, "").replace(/[^\d,.\-]/g, "")
  if (s === "" || s === "-") return NaN
  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  if (lastComma > lastDot) {
    // comma is the decimal separator
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    // dot is the decimal separator (or none)
    s = s.replace(/,/g, "")
  }
  return Number(s)
}

/** Normalize a date cell to YYYY-MM-DD (accepts dd.mm.yyyy or yyyy-mm-dd). */
export function parseDate(input: string): string | null {
  const s = input.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/.exec(s)
  if (m) {
    const d = m[1].padStart(2, "0")
    const mo = m[2].padStart(2, "0")
    return `${m[3]}-${mo}-${d}`
  }
  return null
}

function clean(v: string | undefined): string | null {
  const t = v?.trim()
  return t ? t : null
}

export function parseBankCsv(content: string): CsvParseResult {
  const errors: string[] = []
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    return { transactions: [], errors: ["Súbor neobsahuje žiadne riadky."] }
  }

  const delim = detectDelimiter(lines[0])
  const header = splitLine(lines[0], delim)
  const cols = mapColumns(header)

  if (cols.amount === undefined) {
    errors.push("Nenašiel sa stĺpec so sumou.")
    return { transactions: [], errors }
  }

  const transactions: ParsedTransaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim)
    const amount = parseAmount(cells[cols.amount!] ?? "")
    if (!Number.isFinite(amount)) {
      errors.push(`Riadok ${i + 1}: neplatná suma.`)
      continue
    }
    const raw: Record<string, string> = {}
    header.forEach((h, idx) => (raw[h] = cells[idx] ?? ""))

    transactions.push({
      bookedAt:
        cols.bookedAt !== undefined
          ? parseDate(cells[cols.bookedAt] ?? "")
          : null,
      amount,
      currency:
        cols.currency !== undefined
          ? (clean(cells[cols.currency]) ?? "EUR")
          : "EUR",
      vs: cols.vs !== undefined ? clean(cells[cols.vs]) : null,
      ks: cols.ks !== undefined ? clean(cells[cols.ks]) : null,
      ss: cols.ss !== undefined ? clean(cells[cols.ss]) : null,
      counterparty:
        cols.counterparty !== undefined
          ? clean(cells[cols.counterparty])
          : null,
      message: cols.message !== undefined ? clean(cells[cols.message]) : null,
      raw,
    })
  }

  return { transactions, errors }
}
