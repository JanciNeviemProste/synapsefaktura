/**
 * Merge tags for recurring invoices (SuperFaktúra parity), e.g.
 * "Predplatné za #MESIAC_SLOVOM# #ROK#". Pure — the caller passes the reference
 * date so there is no hidden clock.
 */

const SK_MONTHS = [
  "január",
  "február",
  "marec",
  "apríl",
  "máj",
  "jún",
  "júl",
  "august",
  "september",
  "október",
  "november",
  "december",
]

export const SUPPORTED_MERGE_TAGS = [
  "#ROK#",
  "#MESIAC#",
  "#MESIAC_SLOVOM#",
  "#DATUM#",
] as const

export function applyMergeTags(text: string, date: Date): string {
  if (!text) return text
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const monthWord = SK_MONTHS[date.getMonth()] ?? ""
  const dmy = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`

  return text
    .replaceAll("#MESIAC_SLOVOM#", monthWord)
    .replaceAll("#MESIAC#", String(month))
    .replaceAll("#ROK#", String(year))
    .replaceAll("#DATUM#", dmy)
}

/** Advance a date to the next run for a cadence. */
export function nextRunDate(
  from: Date,
  cadence: "weekly" | "monthly" | "custom",
  intervalDays?: number | null,
): Date {
  const d = new Date(from)
  if (cadence === "weekly") {
    d.setDate(d.getDate() + 7)
  } else if (cadence === "monthly") {
    d.setMonth(d.getMonth() + 1)
  } else {
    d.setDate(
      d.getDate() + (intervalDays && intervalDays > 0 ? intervalDays : 30),
    )
  }
  return d
}

/** Kalendarny den v lokalnej zone ako `YYYY-MM-DD`. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * `YYYY-MM-DD` -> Date na lokalne poludnie. Poludnie zamerne: `new Date("...")`
 * parsuje ISO datum ako UTC polnoc, takze v zapadnych zonach by z 1. dna v
 * mesiaci vysiel posledny den predchadzajuceho. Vrati null pri nepouzitelnom
 * vstupe (v DB je `date`, ale citame ho ako retazec).
 */
export function fromIsoDate(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").slice(0, 10))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Horny limit zameskanych obdobi dobehnutych v JEDNOM behu pre jednu sablonu.
 * Sablona zabudnuta dva roky tak nevygeneruje 24 faktur naraz; zvysok sa
 * dobehne v dalsich behoch (nic sa nezahadzuje).
 */
export const MAX_CATCH_UP_RUNS = 12

export type RecurringPlan = {
  /** Terminy (`YYYY-MM-DD`), pre ktore treba vystavit doklad, od najstarsieho. */
  runDates: string[]
  /** `next_run_at` po spracovani vsetkych terminov z `runDates`. */
  nextRunAt: string
  /** True ked limit zabral a v minulosti ostali dalsie nespracovane obdobia. */
  capped: boolean
}

/**
 * Rozvrh pravidelnej faktury: kolko zameskanych obdobi treba dobehnut a aky je
 * dalsi termin. Cista funkcia — volajuci posiela `today`, ziadne skryte hodiny.
 *
 * Posuva sa VZDY od `nextRunAt`, nie od dnesku: rozvrh preto nedriftuje
 * (faktura z 1. dna v mesiaci ostane na 1.) a vynechane obdobia sa nestratia.
 */
export function planRecurringRuns(
  nextRunAt: string,
  today: string,
  cadence: "weekly" | "monthly" | "custom",
  intervalDays?: number | null,
  maxRuns: number = MAX_CATCH_UP_RUNS,
): RecurringPlan {
  const start = fromIsoDate(nextRunAt)
  if (!start) return { runDates: [], nextRunAt, capped: false }

  const limit = Math.max(0, Math.floor(maxRuns))
  const runDates: string[] = []
  let cursor = start
  let cursorIso = toIsoDate(cursor)

  while (cursorIso <= today && runDates.length < limit) {
    runDates.push(cursorIso)
    cursor = nextRunDate(cursor, cadence, intervalDays)
    cursorIso = toIsoDate(cursor)
  }

  // Pri vycerpanom limite vraciame kurzor v minulosti — dalsi beh pokracuje
  // tam, kde tento skoncil. Preskocit na dnesok by obdobia ticho zahodilo.
  return { runDates, nextRunAt: cursorIso, capped: cursorIso <= today }
}
