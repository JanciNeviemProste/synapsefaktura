import type { VatMode } from "@/lib/validation/org"

/**
 * Mandatory legal note for the VAT mode (§5.2). Returned text is printed on the
 * document. `payer` has no mandatory note. Slovak by default; `en` for foreign
 * customers (multi-language documents).
 *
 * TODO: verify exact wording / legal references against Finančná správa before
 * production (esp. intra-EU and OSS phrasing).
 */
const NOTES: Record<VatMode, { sk: string | null; en: string | null }> = {
  payer: { sk: null, en: null },
  non_payer: {
    sk: "Nie som platiteľ DPH.",
    en: "Not a VAT payer.",
  },
  reverse_charge_domestic: {
    sk: "Prenesenie daňovej povinnosti podľa §69 zákona č. 222/2004 Z. z.",
    en: "Reverse charge (§69 of Act No. 222/2004 Coll.).",
  },
  intra_eu_b2b: {
    sk: "Oslobodené od dane – intrakomunitárne dodanie tovaru (čl. 138 smernice 2006/112/ES).",
    en: "VAT exempt – intra-Community supply (Art. 138 of Directive 2006/112/EC).",
  },
  oss: {
    sk: "Daň priznaná v osobitnej úprave OSS.",
    en: "VAT accounted under the One-Stop-Shop (OSS) scheme.",
  },
  export: {
    sk: "Oslobodené od dane – vývoz tovaru mimo EÚ.",
    en: "VAT exempt – export of goods outside the EU.",
  },
  exempt: {
    sk: "Oslobodené od dane.",
    en: "VAT exempt.",
  },
}

export function legalNoteForVatMode(
  mode: VatMode,
  lang: "sk" | "en" = "sk",
): string | null {
  return NOTES[mode][lang]
}
