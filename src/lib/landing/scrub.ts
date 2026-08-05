/**
 * Prevod pohybu myši na čas vo videu — čistá časť, bez DOM.
 *
 * Toto je jadro celého efektu na úvodnej stránke: postava sa hýbe podľa toho,
 * ako ťaháš myšou. Výpočet je krátky, ale má tri pasce, ktoré sa v prehliadači
 * ladia ťažko — preto je oddelený a otestovaný.
 */

/** Ako silno sa pohyb myši prepisuje do času. Prevzaté z návrhu. */
export const SCRUB_SENSITIVITY = 0.8

/**
 * Nový čas videa po posune myši o `deltaX` pixelov.
 *
 * Pasce, ktoré tu treba ošetriť:
 * 1. **Prejdenie za okraj** — bez orezania by `currentTime` dostal zápornú
 *    hodnotu alebo hodnotu za koncom a prehliadač by seek odmietol.
 * 2. **Neznáme trvanie** — kým sa video nenačíta, `duration` je `NaN`;
 *    počítať s ním by dalo `NaN` a video by zamrzlo.
 * 3. **Nulová šírka okna** — delenie nulou pri veľmi skorom pohybe.
 */
export function nextScrubTime(
  currentTime: number,
  deltaX: number,
  viewportWidth: number,
  duration: number,
  sensitivity: number = SCRUB_SENSITIVITY,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return currentTime
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return currentTime
  if (!Number.isFinite(currentTime)) return 0
  if (!Number.isFinite(deltaX)) return currentTime

  const offset = (deltaX / viewportWidth) * sensitivity * duration
  const next = currentTime + offset
  return Math.min(duration, Math.max(0, next))
}

/**
 * Oplatí sa vôbec seekovať?
 *
 * Bez tohto by sa pri každom pixeli posunu spustil nový seek a prehliadač by
 * sa zahltil — obraz by zamrzol namiesto plynulého pohybu. Prah je menší než
 * jeden snímok pri 24 fps (~0,042 s), takže pohyb ostáva plynulý.
 */
export function isSeekWorthwhile(
  from: number,
  to: number,
  thresholdSeconds = 0.01,
): boolean {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false
  return Math.abs(to - from) > thresholdSeconds
}
