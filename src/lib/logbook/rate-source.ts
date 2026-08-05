/**
 * Vyčítanie zákonnej sadzby cestovnej náhrady zo stránky ministerstva
 * (čisté, bez I/O — sieť rieši cron, sem príde len HTML).
 *
 * Sadzba je daňové číslo. Preto sa tu nič nedomýšľa: keď čokoľvek nesedí,
 * funkcia vráti `null` s dôvodom a cron nič nezapíše. Radšej stará sadzba
 * a záznam v logu než tichá zmena na číslo, ktoré vzniklo zle rozparsovaným
 * HTML po prekopaní stránky.
 *
 * Nájdená sadzba sa navyše nikdy nezapne sama — ukladá sa nepotvrdená
 * (`confirmed_at is null`) a `resolveTravelRate` ju ignoruje, kým ju človek
 * nepotvrdí.
 */

export interface ParsedStatutoryRates {
  /** ISO `YYYY-MM-DD` — odkedy sa sumy uplatňujú. */
  validFrom: string
  /** Napr. `340/2025 Z. z.` */
  sourceRef: string
  /** €/km pre osobné cestné motorové vozidlá. */
  passenger: number
  /** €/km pre jednostopové vozidlá, trojkolky a štvorkolky. */
  motorcycle: number
}

export type ParseResult =
  | { ok: true; rates: ParsedStatutoryRates }
  | { ok: false; reason: string }

/** Sadzba mimo tohto rozsahu je určite chyba parsovania, nie zmena zákona. */
const MIN_RATE = 0.01
const MAX_RATE = 2

const SK_MONTHS: Record<string, number> = {
  januára: 1,
  februára: 2,
  marca: 3,
  apríla: 4,
  mája: 5,
  júna: 6,
  júla: 7,
  augusta: 8,
  septembra: 9,
  októbra: 10,
  novembra: 11,
  decembra: 12,
}

/**
 * Pomenované entity, ktoré sa v slovenskom texte reálne vyskytujú. Bez ich
 * dekódovania by z „januára" ostalo „janu&aacute;ra" a názov mesiaca by sa
 * nedal rozpoznať — dátum účinnosti by vyšiel ako nečitateľný a cron by
 * zmenu sadzby prehliadol.
 */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  ndash: "–",
  mdash: "—",
  aacute: "á",
  auml: "ä",
  ccaron: "č",
  dcaron: "ď",
  eacute: "é",
  iacute: "í",
  lacute: "ĺ",
  lcaron: "ľ",
  ncaron: "ň",
  oacute: "ó",
  ocirc: "ô",
  racute: "ŕ",
  scaron: "š",
  tcaron: "ť",
  uacute: "ú",
  yacute: "ý",
  zcaron: "ž",
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => {
      const decoded = NAMED_ENTITIES[name.toLowerCase()]
      return decoded ?? whole
    })
}

/** Zahodí značky, aby regulárne výrazy nenarazili na `<strong>` uprostred sumy. */
function toText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ")
}

/** „1. januára 2026" → `2026-01-01`. */
function parseSkDate(text: string): string | null {
  const m = /(\d{1,2})\.\s*([a-záäčďéíĺľňóôŕšťúýž]+)\s+(\d{4})/i.exec(text)
  if (!m) return null
  const day = Number(m[1])
  const month = SK_MONTHS[m[2].toLowerCase()]
  const year = Number(m[3])
  if (!month || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Suma pre danú kategóriu vozidla.
 *
 * Stránka ministerstva oznamuje ZMENU, nie stav: „pre jednostopové vozidlá
 * a trojkolky z 0,085 eura/km **na** 0,090 eura/km". Brať prvé číslo za
 * popiskom by preto dalo STARÚ sadzbu. Najprv sa teda hľadá tvar „… na X",
 * a až keď nie je, berie sa prvé číslo za popiskom (tak sumy uvádza napr.
 * Národný inšpektorát práce).
 */
function amountFor(text: string, label: string): number | null {
  // Okno sa zastaví na konci vety, ale dvojbodku prepustí — zoznamy sa píšu
  // ako „osobné vozidlá: 0,313 eura" a bez toho by sa suma k popisku
  // nepriradila. Lenivý kvantifikátor berie najbližšie číslo za popiskom,
  // takže sa nedá prekĺznuť do sumy inej kategórie.
  const window = "[^.;]{0,200}?"
  const patterns = [
    new RegExp(`${label}${window}\\bna\\s+(\\d,\\d{3})\\s*eur`, "i"),
    new RegExp(`${label}${window}(\\d,\\d{3})\\s*eur`, "i"),
  ]
  for (const re of patterns) {
    const m = re.exec(text)
    if (m) return Number(m[1].replace(",", "."))
  }
  return null
}

/**
 * Číslo OZNÁMENIA, ktorým sa nové sumy vyhlasujú.
 *
 * Na stránke sú čísla predpisov aj tri: zákon o cestovných náhradách
 * (283/2002), jeho novela (297/2024), predchádzajúce oznámenie a to nové.
 * Preto sa hľadajú len tie, pred ktorými je slovo „oznámenie/oznámením",
 * a berie sa POSLEDNÉ — nové sa vyhlasuje na konci textu, staré je len
 * odkaz na to, čo platilo doteraz.
 *
 * Koncovka býva odseknutá („č. 340/2025 Z."), tak sa `z.` nevyžaduje.
 */
function findAnnouncement(text: string): string | null {
  const re = /ozn[áa]men[^.]{0,160}?č\.\s*(\d{1,4}\/\d{4})/gi
  let last: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) last = m[1]
  return last
}

/**
 * Najneskorší dátum účinnosti na stránke.
 *
 * Text spomína aj to, odkedy platili PREDCHÁDZAJÚCE sumy („začali sa
 * uplatňovať od 1. júna 2025"), a to býva skôr než veta o nových. Brať prvý
 * nájdený dátum by preto vrátilo starú účinnosť.
 */
function findLatestDate(text: string): string | null {
  const re = /\bod\s+(\d{1,2}\.\s*[a-záäčďéíĺľňóôŕšťúýž]+\s+\d{4})/gi
  let latest: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const iso = parseSkDate(m[1])
    if (iso && (latest === null || iso > latest)) latest = iso
  }
  return latest
}

/**
 * Vyčíta sadzby zo stránky. `null` vždy s dôvodom — cron ho zaloguje, takže
 * rozbité parsovanie sa dá odhaliť skôr, než niekomu vyjde zlá náhrada.
 */
export function parseStatutoryRates(html: string): ParseResult {
  const text = toText(html)

  const announcement = findAnnouncement(text)
  if (!announcement) {
    return { ok: false, reason: "na stránke nie je číslo oznámenia (č. NNN/RRRR)" }
  }
  const sourceRef = `${announcement} Z. z.`

  const validFrom = findLatestDate(text)
  if (!validFrom) {
    return { ok: false, reason: "nedá sa prečítať dátum účinnosti" }
  }

  // Popisky podľa znenia predpisu. `jednostopov` pokrýva aj tvar
  // „dvojkolesové, trojkolesové vozidlá a štvorkolky", ktorý používa novšie
  // znenie, preto sa skúšajú obidva.
  const passenger = amountFor(text, "osobn[éeý]")
  const motorcycle =
    amountFor(text, "jednostopov") ??
    amountFor(text, "dvojkolesov") ??
    amountFor(text, "trojkolk")

  if (passenger === null || motorcycle === null) {
    return {
      ok: false,
      reason: `sadzba sa nedá priradiť ku kategórii (osobné: ${passenger}, jednostopové: ${motorcycle})`,
    }
  }

  for (const [label, value] of [
    ["osobné vozidlá", passenger],
    ["jednostopové vozidlá", motorcycle],
  ] as const) {
    if (value < MIN_RATE || value > MAX_RATE) {
      return {
        ok: false,
        reason: `sadzba pre ${label} je ${value} €/km, mimo rozsahu ${MIN_RATE}–${MAX_RATE}`,
      }
    }
  }

  if (passenger <= motorcycle) {
    return {
      ok: false,
      reason: "sadzba pre osobné vozidlo nie je vyššia než pre jednostopové",
    }
  }

  return { ok: true, rates: { validFrom, sourceRef, passenger, motorcycle } }
}

/**
 * Je nájdená sadzba naozaj novšia než tá, ktorú už máme?
 *
 * Zákonný mechanizmus sadzbu iba ZVYŠUJE — spúšťa sa pri raste cenového indexu
 * o 5 %. Nižšia hodnota preto znamená chybu parsovania, nie zmenu zákona,
 * a je to najsilnejšia poistka, ktorú tu máme.
 */
export function isNewerStatutoryRate(
  found: ParsedStatutoryRates,
  current: { validFrom: string; passenger: number; sourceRef: string | null } | null,
): { ok: true } | { ok: false; reason: string } {
  if (!current) return { ok: true }

  if (found.sourceRef === current.sourceRef) {
    return { ok: false, reason: "rovnaký predpis, sadzba sa nezmenila" }
  }
  if (found.validFrom <= current.validFrom) {
    return {
      ok: false,
      reason: `nájdená účinnosť ${found.validFrom} nie je novšia než ${current.validFrom}`,
    }
  }
  if (found.passenger < current.passenger) {
    return {
      ok: false,
      reason: `nájdená sadzba ${found.passenger} je NIŽŠIA než súčasná ${current.passenger} — zákon sadzbu neznižuje, takže ide o chybu parsovania`,
    }
  }
  return { ok: true }
}
