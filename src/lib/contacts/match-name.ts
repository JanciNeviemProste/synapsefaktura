/**
 * Skórovanie zhody názvu kontaktu (čistá funkcia, bez DB).
 *
 * Slúži na spárovanie názvu firmy, ktorý z vety vytiahne AI, s existujúcim
 * kontaktom. Je zámerne konzervatívne: radšej nespárovať nič a nechať kontakt
 * prázdny, než trafiť cudziu firmu. Preto názvy, ktoré sú iba právna forma
 * („s.r.o.“) alebo jedno písmeno („a“), nespárujú nikdy — po odstránení
 * právnej formy a jednopísmenových tokenov im neostane žiadne jadro.
 */

/** Minimálne skóre, pri ktorom sa kontakt ešte spáruje. Pod ním neparujeme. */
export const MIN_NAME_MATCH_SCORE = 0.6

/** Podreťazcová zhoda musí mať aspoň toľko znakov… */
export const MIN_SUBSTRING_LENGTH = 4

/** …a pokryť aspoň toľko z dĺžky dlhšieho z porovnávaných názvov. */
export const MIN_SUBSTRING_RATIO = 0.6

/**
 * Tokeny právnych foriem — nesmú samy o sebe rozhodnúť o zhode. Jednopísmenové
 * tokeny (z „s. r. o.“, „a. s.“) sa zahadzujú osobitne podľa dĺžky.
 */
const LEGAL_FORM_TOKENS: ReadonlySet<string> = new Set([
  "sro",
  "spol",
  "as",
  "ks",
  "vos",
  "oz",
  "ltd",
  "llc",
  "inc",
  "gmbh",
  "ag",
  "bv",
  "nv",
])

/** Bez diakritiky, malé písmená, interpunkcia → medzera, zbytočné medzery preč. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * „Jadro“ názvu = normalizovaný názov bez právnych foriem a jednopísmenových
 * tokenov. Prázdne jadro znamená, že názov nenesie žiadnu identitu firmy.
 */
export function nameCore(s: string): string {
  const normalized = normalizeName(s)
  if (!normalized) return ""
  return normalized
    .split(" ")
    .filter((t) => t.length > 1 && !LEGAL_FORM_TOKENS.has(t))
    .join(" ")
}

/** Obsahuje `haystack` celé `needle` ako súvislú postupnosť slov? */
function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `)
}

/**
 * Skóre zhody názvu kontaktu s hľadaným textom v rozsahu 0–1:
 * 1.0 presná zhoda · 0.9 zhoda jadier · 0.8 jadro ako celé slovo (slová) v tom
 * druhom · 0.6 dostatočne dlhý podreťazec · 0 inak (neparovať).
 */
export function scoreNameMatch(contactName: string, query: string): number {
  const normalizedContact = normalizeName(contactName)
  const normalizedQuery = normalizeName(query)
  if (!normalizedContact || !normalizedQuery) return 0
  if (normalizedContact === normalizedQuery) return 1

  const contactCore = nameCore(normalizedContact)
  const queryCore = nameCore(normalizedQuery)
  // Samotná právna forma alebo jedno písmeno nikdy nie je zhoda.
  if (!contactCore || !queryCore) return 0
  if (contactCore === queryCore) return 0.9

  if (
    containsWords(queryCore, contactCore) ||
    containsWords(contactCore, queryCore)
  ) {
    return 0.8
  }

  const [shorter, longer] =
    contactCore.length <= queryCore.length
      ? [contactCore, queryCore]
      : [queryCore, contactCore]
  if (
    shorter.length >= MIN_SUBSTRING_LENGTH &&
    shorter.length >= MIN_SUBSTRING_RATIO * longer.length &&
    longer.includes(shorter)
  ) {
    return 0.6
  }

  return 0
}

export type ContactNameCandidate = { id: string; name: string }

/**
 * Najlepšie skórujúci kontakt, alebo null, keď žiadny nedosiahne prah. Pri
 * rovnakom skóre vyhráva dlhší (konkrétnejší) názov — nie prvý v poradí.
 */
export function matchContactByName<T extends ContactNameCandidate>(
  contacts: readonly T[],
  query: string | null | undefined,
): T | null {
  if (!query) return null

  let best: T | null = null
  let bestScore = 0
  for (const contact of contacts) {
    const score = scoreNameMatch(contact.name, query)
    if (score < MIN_NAME_MATCH_SCORE) continue
    if (
      score > bestScore ||
      (best !== null &&
        score === bestScore &&
        normalizeName(contact.name).length > normalizeName(best.name).length)
    ) {
      best = contact
      bestScore = score
    }
  }

  return best
}
