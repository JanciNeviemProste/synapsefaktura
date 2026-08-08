import { parseTable, findColumn, normalizeHeader } from "@/lib/import/table"

/**
 * Import klientov z tabuľky (čisté, bez I/O).
 *
 * Stĺpce sa hľadajú podľa NÁZVU hlavičky, nie podľa poradia — používateľ si
 * môže stĺpce presunúť alebo pridať vlastné a import to prežije. Povinný je
 * jediný: názov.
 *
 * Chybný riadok import nezhodí. Zbiera sa zoznam problémov s číslom riadku,
 * aby používateľ vedel, čo presne opraviť.
 */

export interface ImportedContact {
  type: "customer" | "supplier" | "both"
  name: string
  ico?: string
  dic?: string
  icDph?: string
  street?: string
  city?: string
  postalCode?: string
  country: string
  email?: string
  phone?: string
  notes?: string
}

export interface ContactImportResult {
  contacts: ImportedContact[]
  /** Riadky, ktoré sa nedali použiť — s číslom riadku tak, ako ho vidí Excel. */
  errors: string[]
  /** Hlavičky, ktoré import nepozná. Len na informáciu, nie chyba. */
  ignoredColumns: string[]
}

/** Ako sa volajú stĺpce, ktoré vieme prečítať. */
const COLUMNS = {
  name: ["nazov", "meno", "firma", "obchodne meno", "name", "company"],
  type: ["typ", "type"],
  ico: ["ico", "ic"],
  dic: ["dic"],
  icDph: ["ic dph", "icdph", "ic_dph", "vat", "dic dph"],
  street: ["ulica", "adresa", "street", "address"],
  city: ["mesto", "obec", "city"],
  postalCode: ["psc", "postal code", "zip"],
  country: ["krajina", "stat", "country"],
  email: ["email", "e-mail", "mail"],
  phone: ["telefon", "tel", "phone", "mobil"],
  notes: ["poznamka", "poznamky", "note", "notes"],
} as const

/**
 * Typ kontaktu zo slovenského aj anglického zápisu.
 *
 * V DB je anglický enum, ale používateľ v tabuľke napíše „Odberateľ" — a to
 * je aj to, čo mu appka ukazuje. Import musí zvládnuť oboje.
 */
function parseType(raw: string): ImportedContact["type"] {
  const v = normalizeHeader(raw)
  if (v === "") return "customer"
  if (v.startsWith("dodav") || v === "supplier") return "supplier"
  if (v.startsWith("oboj") || v === "both") return "both"
  return "customer"
}

/** Základná kontrola tvaru e-mailu. Nesprávny sa zahodí, riadok prejde. */
function cleanEmail(raw: string): string | undefined {
  const v = raw.trim()
  if (v === "") return undefined
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined
}

function cell(row: string[], idx: number): string {
  return idx === -1 ? "" : (row[idx] ?? "").trim()
}

function optional(value: string): string | undefined {
  return value === "" ? undefined : value
}

/** CSV — obal nad `contactsFromRows`. */
export function parseContactsTable(content: string): ContactImportResult {
  const { header, rows } = parseTable(content)
  return contactsFromRows(header, rows)
}

/**
 * Jadro importu nad uz rozparsovanymi riadkami.
 *
 * Zdielane medzi CSV a XLSX zamerne: mapovanie stlpcov, preklad typu, kontrola
 * e-mailu aj hlasenie chyb musia byt v OBOCH cestach rovnake. Dve kopie by sa
 * skor ci neskor rozisli a pouzivatel by dostal iny vysledok podla toho, ci
 * ulozil tabulku ako CSV alebo XLSX.
 *
 * `header` sa ocakava uz normalizovany (`normalizeHeader`).
 */
export function contactsFromRows(
  header: string[],
  rows: string[][],
): ContactImportResult {
  if (header.length === 0) {
    return { contacts: [], errors: ["Súbor je prázdny."], ignoredColumns: [] }
  }

  const idx = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, keys]) => [
      key,
      findColumn(header, [...keys]),
    ]),
  ) as Record<keyof typeof COLUMNS, number>

  if (idx.name === -1) {
    return {
      contacts: [],
      errors: [
        "V tabuľke chýba stĺpec s názvom firmy. Očakávame hlavičku „Názov“.",
      ],
      ignoredColumns: [],
    }
  }

  const used = new Set(Object.values(idx).filter((i) => i !== -1))
  const ignoredColumns = header.filter((_, i) => !used.has(i))

  const contacts: ImportedContact[] = []
  const errors: string[] = []
  // Mena uz videne v tomto subore — dva rovnake riadky nemaju vyrobit
  // dva rovnake kontakty.
  const seen = new Set<string>()

  rows.forEach((row, i) => {
    // +2: hlavicka je prvy riadok a Excel cisluje od jednotky.
    const lineNo = i + 2
    const name = cell(row, idx.name)
    if (name === "") {
      errors.push(`Riadok ${lineNo}: chýba názov, preskočené.`)
      return
    }
    const key = normalizeHeader(name)
    if (seen.has(key)) {
      errors.push(
        `Riadok ${lineNo}: „${name}“ je v súbore viackrát, preskočené.`,
      )
      return
    }
    seen.add(key)

    const emailRaw = cell(row, idx.email)
    const email = cleanEmail(emailRaw)
    if (emailRaw !== "" && email === undefined) {
      errors.push(
        `Riadok ${lineNo}: „${emailRaw}“ nevyzerá ako e-mail, kontakt sa uloží bez neho.`,
      )
    }

    contacts.push({
      type: parseType(cell(row, idx.type)),
      name,
      ico: optional(cell(row, idx.ico)),
      dic: optional(cell(row, idx.dic)),
      icDph: optional(cell(row, idx.icDph)),
      street: optional(cell(row, idx.street)),
      city: optional(cell(row, idx.city)),
      postalCode: optional(cell(row, idx.postalCode)),
      country: optional(cell(row, idx.country)) ?? "SK",
      email,
      phone: optional(cell(row, idx.phone)),
      notes: optional(cell(row, idx.notes)),
    })
  })

  return { contacts, errors, ignoredColumns }
}

/** Hlavičky vzorovej tabuľky — používa ju aj súbor na stiahnutie. */
export const CONTACT_TEMPLATE_HEADER = [
  "Názov",
  "Typ",
  "IČO",
  "DIČ",
  "IČ DPH",
  "Ulica",
  "Mesto",
  "PSČ",
  "Krajina",
  "E-mail",
  "Telefón",
  "Poznámka",
] as const

/** Dva ukážkové riadky, aby bolo vidieť očakávaný tvar. */
export const CONTACT_TEMPLATE_ROWS = [
  [
    "Ukážka s.r.o.",
    "Odberateľ",
    "12345678",
    "2020123456",
    "SK2020123456",
    "Hlavná 1",
    "Bratislava",
    "81101",
    "SK",
    "faktury@ukazka.sk",
    "+421900123456",
    "",
  ],
  [
    "Dodávateľ a spol.",
    "Dodávateľ",
    "87654321",
    "",
    "",
    "Krátka 5",
    "Košice",
    "04001",
    "SK",
    "",
    "",
    "platí v hotovosti",
  ],
] as const
