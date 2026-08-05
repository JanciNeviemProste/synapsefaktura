/**
 * Limity nahrávaných súborov — jedno miesto pre klienta aj server.
 *
 * PREČO NA TOM ZÁLEŽÍ: čokoľvek, čo ide cez Server Action, prechádza serverovou
 * funkciou Vercelu a tá má **tvrdý strop 4,5 MB na telo požiadavky**
 * (`FUNCTION_PAYLOAD_TOO_LARGE`). Ten sa nedá zvýšiť nastavením —
 * `serverActions.bodySizeLimit` vie strop len znížiť, nie prekonať.
 *
 * Preto sú dve cesty:
 *
 * 1. **Malé súbory a text** (bankový výpis, tabuľka klientov) — cez Server
 *    Action. Limit musí byť BEZPEČNE pod 4,5 MB, lebo multipart pridáva réžiu.
 * 2. **Obrázky a prílohy** (logo, podpis, pečiatka, bloček) — z prehliadača
 *    **priamo do úložiska** cez podpísanú adresu, takže sa serverovej funkcie
 *    vôbec nedotknú. Tam platí len limit Supabase Storage (50 MB).
 */

/**
 * Strop pre cestu cez Server Action. Vercel odreže na 4,5 MB, tak sme pod tým
 * — nech používateľ dostane našu zrozumiteľnú hlášku a nie HTTP 413.
 */
export const MAX_ACTION_BYTES = 4 * 1024 * 1024

/** Bankový výpis a tabuľka klientov — text, ide cez Server Action. */
export const MAX_IMPORT_BYTES = MAX_ACTION_BYTES

/**
 * Príloha nákladu a fotka bločka. Ide PRIAMO do úložiska, takže strop
 * serverovej funkcie neplatí — 25 MB pokryje aj fotku z 48 Mpx telefónu.
 */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

/**
 * Logo, podpis a pečiatka. Do PDF sa vykresľuje obrázok vysoký ~34 bodov,
 * takže nad tento strop nemá zmysel ísť ani pri tlači do vysokého rozlíšenia.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** Hláška, ktorá povie aj to, čo s tým. */
export function tooLargeMessage(bytes: number, limitBytes: number): string {
  const mb = (bytes / (1024 * 1024)).toFixed(1)
  const limitMb = Math.round(limitBytes / (1024 * 1024))
  return `Súbor má ${mb} MB, povolených je najviac ${limitMb} MB.`
}
