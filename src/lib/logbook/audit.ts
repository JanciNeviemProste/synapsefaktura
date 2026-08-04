/**
 * Kontrola konzistencie knihy jazd PRED danovou kontrolou.
 *
 * Preco to existuje: kniha jazd je danovy podklad. Kontrolor porovna najazdene
 * km x normovanu spotrebu oproti realne nakupenemu palivu a uzna len to NIZSIE
 * z dvojice. Tento modul spusti tu istu aritmetiku dopredu, aby sa nezrovnalost
 * dala vysvetlit alebo opravit este predtym, nez ju najde niekto iny.
 *
 * Ciste a deterministicke — ziadne I/O, ziadna AI. Server action nacita riadky
 * a poda ich sem. Samotny vypocet paliva je v `logbook/consumption.ts`, tu sa
 * len interpretuje.
 */

import { deductibleFuel, normedFuelLitres } from "@/lib/logbook/consumption"

/** Jeden nalez — nieco, co treba pred kontrolou opravit alebo vysvetlit. */
export type LogbookFinding = {
  severity: "error" | "warning" | "info"
  code: string
  message: string
}

export type AuditVehicle = {
  /** Normovana (kombinovana) spotreba z technickeho preukazu, l/100 km. */
  consumptionPer100Km: number | null
  odometerKm: number
}

export type AuditTrip = {
  date: string
  km: number
  /** Sukromne jazdy auto realne najazdilo, ale danovo uznatelne nie su. */
  purpose: "business" | "private"
  odometerStart: number | null
  odometerEnd: number | null
}

export type AuditRefueling = {
  date: string
  litres: number
}

export type AuditInput = {
  vehicle: AuditVehicle
  trips: AuditTrip[]
  refuelings: AuditRefueling[]
  periodFrom: string
  periodTo: string
}

/**
 * Palivo v nadrzi nekopiruje kalendar: tankuje sa dopredu a obdobie zacina aj
 * konci s nejakym zostatkom. Preto sa hlasi az rozdiel nad tolerancie, nie
 * kazda desatina litra.
 */
const SHORTAGE_TOLERANCE = 0.05 // 5 % pod normou este neriesime
const SURPLUS_TOLERANCE = 0.2 // 20 % nad normou uz naznacuje chybajuce jazdy
/** Pod tolko litrov je prebytok bez vypovednej hodnoty (jedno natankovanie). */
const MIN_SURPLUS_LITRES = 5
/** Tachometer sa vedie na desatiny km; mensi rozdiel je zaokruhlenie. */
const ODOMETER_EPSILON = 0.05

const SEVERITY_RANK: Record<LogbookFinding["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
}

// --- formatovanie cisel do sprav --------------------------------------------

function formatNumber(value: number, decimals: number): string {
  return new Intl.NumberFormat("sk-SK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Kilometre: cele cislo ked to vyjde, inak jedna desatina. */
function km(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${formatNumber(rounded, Number.isInteger(rounded) ? 0 : 1)} km`
}

/** Litre vzdy na jednu desatinu — tak ich pise aj doklad z pumpy. */
function litres(value: number): string {
  return `${formatNumber(Math.round(value * 10) / 10, 1)} l`
}

/** ISO datum na slovensky zapis; zamerne bez `Date`, aby nezasiahla zona. */
function day(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])}.${Number(m[2])}.${m[1]}`
}

// --- pomocne ----------------------------------------------------------------

/** ISO datumy sa daju porovnavat ako retazce, takze obdobie je proste interval. */
function inPeriod(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

// --- jednotlive kontroly ----------------------------------------------------

/**
 * Diera v tachometri: koncovy stav jednej jazdy nesedi so zaciatocnym stavom
 * nasledujucej. Nahor = nezaevidovane km (warning — moze ist o sukromnu jazdu,
 * ktoru niekto zabudol zapisat). Nadol = tachometer sa vratil, co sa fyzicky
 * stat nemoze (error).
 */
function odometerFindings(trips: AuditTrip[]): LogbookFinding[] {
  const chain = trips
    .filter((t) => t.odometerStart !== null && t.odometerEnd !== null)
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? a.odometerStart! - b.odometerStart!
        : a.date < b.date
          ? -1
          : 1,
    )

  const out: LogbookFinding[] = []
  for (let i = 1; i < chain.length; i++) {
    const prev = chain[i - 1]
    const next = chain[i]
    const diff = next.odometerStart! - prev.odometerEnd!
    if (diff > ODOMETER_EPSILON) {
      out.push({
        severity: "warning",
        code: "odometer_gap",
        message:
          `Diera v tachometri: jazda ${day(next.date)} začína na ${km(next.odometerStart!)}, ` +
          `predchádzajúca skončila na ${km(prev.odometerEnd!)} — chýba ${km(diff)}.`,
      })
    } else if (diff < -ODOMETER_EPSILON) {
      out.push({
        severity: "error",
        code: "odometer_backwards",
        message:
          `Stav tachometra klesol: jazda ${day(next.date)} začína na ${km(next.odometerStart!)}, ` +
          `hoci predchádzajúca skončila na ${km(prev.odometerEnd!)}.`,
      })
    }
  }
  return out
}

/** Tankovanie v den, ku ktoremu nie je ziadna jazda. */
function refuelingWithoutTripFindings(
  trips: AuditTrip[],
  refuelings: AuditRefueling[],
): LogbookFinding[] {
  const tripDays = new Set(trips.map((t) => t.date))
  return refuelings
    .filter((r) => !tripDays.has(r.date))
    .map((r) => ({
      severity: "info" as const,
      code: "refueling_without_trip",
      message: `Tankovanie ${day(r.date)} (${litres(r.litres)}) nemá v ten deň žiadnu jazdu.`,
    }))
}

// --- verejne API ------------------------------------------------------------

/**
 * Prejde jazdy a tankovania za obdobie a vrati zoznam nezrovnalosti zoradeny
 * podla zavaznosti. Prazdne pole znamena, ze cisla sedia.
 *
 * Do spotreby sa zapocitavaju VSETKY jazdy vratane sukromnych — auto ich
 * najazdilo a palivo minulo. Do danovo uznatelnych nakladov ide len sluzobna
 * cast; ten rozdiel hlasi samostatny info nalez.
 */
export function auditLogbook(input: AuditInput): LogbookFinding[] {
  const { periodFrom, periodTo } = input
  const trips = input.trips.filter((t) =>
    inPeriod(t.date, periodFrom, periodTo),
  )
  const refuelings = input.refuelings.filter((r) =>
    inPeriod(r.date, periodFrom, periodTo),
  )

  const findings: LogbookFinding[] = []

  const totalKm = sum(trips.map((t) => t.km))
  const privateKm = sum(
    trips.filter((t) => t.purpose === "private").map((t) => t.km),
  )
  const businessKm = totalKm - privateKm
  const purchasedLitres = sum(refuelings.map((r) => r.litres))

  const consumption = input.vehicle.consumptionPer100Km
  // Nula sa berie ako nevyplnene: auto, ktore nespotrebuje nic, neexistuje.
  const hasConsumption =
    consumption !== null && Number.isFinite(consumption) && consumption > 0
  const fuel = hasConsumption
    ? deductibleFuel({ km: totalKm, consumption, purchasedLitres })
    : null

  if (!hasConsumption) {
    findings.push({
      severity: "error",
      code: "missing_consumption",
      message:
        "Vozidlo nemá vyplnenú normovanú spotrebu (l/100 km), takže daňovo " +
        "uznateľné palivo sa nedá vyrátať. Doplň ju z technického preukazu.",
    })
  } else if (fuel !== null) {
    // Nedostatok paliva: kniha jazd vykazuje viac jazdenia, nez na kolko je
    // dokladov. Uznat sa da len to nizsie — teda nakupene palivo.
    if (
      totalKm > 0 &&
      fuel.purchasedLitres < fuel.normedLitres * (1 - SHORTAGE_TOLERANCE)
    ) {
      findings.push({
        severity: "error",
        code: "fuel_shortage",
        message:
          `Nedostatok paliva: vykázaných ${km(totalKm)} zodpovedá ${litres(fuel.normedLitres)}, ` +
          `natankovaných bolo len ${litres(fuel.purchasedLitres)}. Uznať sa dá len nižšie ` +
          `z dvojice, teda ${litres(fuel.litres)} — chýba doklad na ${litres(fuel.difference)}.`,
      })
    }

    // Prebytok paliva: nakupene vyrazne viac, nez zodpoveda jazdam. Warning, nie
    // error — nadrz sa moze natankovat do zasoby na dalsie obdobie.
    if (
      fuel.purchasedLitres > fuel.normedLitres * (1 + SURPLUS_TOLERANCE) &&
      fuel.difference >= MIN_SURPLUS_LITRES
    ) {
      findings.push({
        severity: "warning",
        code: "fuel_surplus",
        message:
          `Prebytok paliva: natankovaných ${litres(fuel.purchasedLitres)}, ale vykázaným ` +
          `${km(totalKm)} zodpovedá len ${litres(fuel.normedLitres)}. Rozdiel ` +
          `${litres(fuel.difference)} naznačuje jazdy, ktoré nie sú zapísané.`,
      })
    }
  }

  findings.push(...odometerFindings(trips))
  findings.push(...refuelingWithoutTripFindings(trips, refuelings))

  // Sukromne km sa do spotreby zapocitavaju, do uznatelnych nakladov nie.
  if (privateKm > 0) {
    const privateLitres = hasConsumption
      ? normedFuelLitres(privateKm, consumption)
      : null
    const businessLitres = hasConsumption
      ? normedFuelLitres(businessKm, consumption)
      : null
    const detail =
      privateLitres === null || businessLitres === null
        ? `; služobných je ${km(businessKm)}`
        : ` (${litres(privateLitres)}); služobných je ${km(businessKm)} (${litres(businessLitres)})`
    findings.push({
      severity: "info",
      code: "private_share",
      message:
        `Z ${km(totalKm)} je ${km(privateKm)} súkromných${detail}. Súkromné jazdy sa ` +
        `do spotreby započítavajú, ale do daňovo uznateľných nákladov nie.`,
    })
  }

  // Stabilne zoradenie podla zavaznosti; v ramci rovnakej zavaznosti zostava
  // poradie, v akom nalezy vznikli (chronologicky).
  return findings
    .map((f, i) => ({ f, i }))
    .sort((a, b) =>
      SEVERITY_RANK[a.f.severity] === SEVERITY_RANK[b.f.severity]
        ? a.i - b.i
        : SEVERITY_RANK[a.f.severity] - SEVERITY_RANK[b.f.severity],
    )
    .map(({ f }) => f)
}
