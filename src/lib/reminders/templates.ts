/**
 * Template-based payment reminders (upomienky) with escalating tone.
 * Phase 2 is non-AI; AI smart reminders arrive in Phase 3 (§7.6).
 */

export interface ReminderContext {
  documentNumber: string
  customerName: string
  amount: string // already formatted, e.g. "246,00 €"
  dueDate: string // DD.MM.YYYY
  daysOverdue: number
  supplierName: string
}

export interface ReminderMessage {
  level: number
  tone: "gentle" | "firm" | "final"
  subject: string
  body: string
}

const TONES = ["gentle", "firm", "final"] as const

export function reminderTemplate(
  level: number,
  ctx: ReminderContext,
): ReminderMessage {
  const lvl = Math.min(Math.max(level, 1), 3)
  const tone = TONES[lvl - 1]

  const subject = `Upomienka k faktúre ${ctx.documentNumber}`
  const head = `Dobrý deň,\n\n`
  const foot = `\n\nS pozdravom,\n${ctx.supplierName}`

  let body: string
  if (lvl === 1) {
    body =
      `dovoľujeme si Vás zdvorilo upozorniť, že faktúra ${ctx.documentNumber} ` +
      `na sumu ${ctx.amount} so splatnosťou ${ctx.dueDate} zatiaľ nebola uhradená. ` +
      `Ak ste platbu už realizovali, považujte túto správu za bezpredmetnú.`
  } else if (lvl === 2) {
    body =
      `opakovane Vás žiadame o úhradu faktúry ${ctx.documentNumber} na sumu ` +
      `${ctx.amount}, ktorá je po splatnosti už ${ctx.daysOverdue} dní ` +
      `(splatnosť ${ctx.dueDate}). Prosíme o bezodkladné uhradenie.`
  } else {
    body =
      `ide o poslednú výzvu na úhradu faktúry ${ctx.documentNumber} na sumu ` +
      `${ctx.amount}, ktorá je ${ctx.daysOverdue} dní po splatnosti. ` +
      `V prípade neuhradenia budeme nútení pristúpiť k ďalším krokom na vymáhanie pohľadávky.`
  }

  return { level: lvl, tone, subject, body: head + body + foot }
}
