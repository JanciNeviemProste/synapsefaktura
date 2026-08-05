/**
 * Písací efekt — čistá časť, bez Reactu a bez časovačov.
 *
 * Rozdelené zámerne: samotný hook je pár riadkov okolo `setInterval`, ale
 * výpočet „koľko znakov už má byť vidieť" je to, čo sa dá pokaziť — a čo sa
 * dá otestovať bez prehliadača.
 */

export const TYPEWRITER_SPEED_MS = 38
export const TYPEWRITER_START_DELAY_MS = 600

/**
 * Počet odhalených znakov v danom čase od začiatku.
 *
 * Nikdy nepresiahne dĺžku textu a pred uplynutím oneskorenia je nula —
 * bez toho by prvý znak preblikol skôr, než sa stránka usadí.
 */
export function revealedCount(
  elapsedMs: number,
  length: number,
  speedMs: number = TYPEWRITER_SPEED_MS,
  startDelayMs: number = TYPEWRITER_START_DELAY_MS,
): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= startDelayMs) return 0
  if (length <= 0) return 0
  // Delenie nulou alebo záporná rýchlosť by dali Infinity/NaN — vtedy je
  // jediná rozumná odpoveď „celý text naraz".
  if (!Number.isFinite(speedMs) || speedMs <= 0) return length
  const typed = Math.floor((elapsedMs - startDelayMs) / speedMs)
  return Math.min(length, Math.max(0, typed))
}

/** Koľko trvá napísať celý text — na odhad, kedy sa má schovať kurzor. */
export function totalDurationMs(
  length: number,
  speedMs: number = TYPEWRITER_SPEED_MS,
  startDelayMs: number = TYPEWRITER_START_DELAY_MS,
): number {
  if (length <= 0) return startDelayMs
  return startDelayMs + length * speedMs
}
