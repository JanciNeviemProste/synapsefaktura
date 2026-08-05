/**
 * Limity nahrávaných súborov — jedno miesto pre klienta aj server.
 *
 * PREČO TO VÔBEC JE: všetky súbory idú do appky cez Server Actions a tie majú
 * predvolený strop **1 MB**. Nad ním požiadavka skončí na HTTP 413 ešte
 * predtým, než sa dostane k akejkoľvek našej kontrole — a server action vtedy
 * VYHODÍ výnimku namiesto výsledku, takže sa nezobrazí ani hláška. Bežná fotka
 * bločku z mobilu (2–5 MB) tak zlyhávala neviditeľne.
 *
 * Strop je zdvihnutý v `next.config.ts` (`serverActions.bodySizeLimit`).
 * Tieto hodnoty musia byť POD ním, aby používateľ dostal zrozumiteľnú hlášku
 * a nie 413.
 */

/** Príloha nákladu a fotka pre AI vyťaženie. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

/** Bankový výpis v CSV. Ročný výpis sa do toho zmestí s rezervou. */
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024

/** Hláška, ktorá povie aj to, čo s tým. */
export function tooLargeMessage(bytes: number, limitBytes: number): string {
  const mb = (bytes / (1024 * 1024)).toFixed(1)
  const limitMb = Math.round(limitBytes / (1024 * 1024))
  return `Súbor má ${mb} MB, povolených je najviac ${limitMb} MB.`
}
