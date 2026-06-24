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
