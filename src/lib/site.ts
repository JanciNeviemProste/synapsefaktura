/**
 * Central site / operator config for public pages (footer, legal, contact).
 *
 * ⚠️ DOPLŇ pred ostrým predajom: firemné údaje prevádzkovateľa a reálny support
 * e-mail. Právne texty sú šablóny — daj ich skontrolovať právnikovi/účtovníkovi.
 */
export const SITE = {
  name: "Synapse Faktúra",
  // TODO: nastav reálny support e-mail (napr. na vlastnej doméne).
  supportEmail: "podpora@synapsefaktura.sk",

  /** Prevádzkovateľ (operator) — DOPLŇ reálne údaje. */
  company: {
    legalName: "[DOPLŇ obchodné meno]",
    ico: "[DOPLŇ IČO]",
    dic: "[DOPLŇ DIČ]",
    address: "[DOPLŇ sídlo]",
    registration: "[DOPLŇ zápis v ORSR / živnostenskom registri]",
  },

  /** Sprostredkovatelia (GDPR processors), ktorým odovzdávame údaje. */
  processors: [
    { name: "Supabase", purpose: "databáza a autentifikácia", region: "EÚ" },
    { name: "Vercel", purpose: "hosting aplikácie", region: "EÚ / USA" },
    { name: "Stripe", purpose: "spracovanie platieb", region: "EÚ / USA" },
    { name: "Resend", purpose: "odosielanie e-mailov", region: "EÚ / USA" },
    { name: "Upstash", purpose: "ochrana pred zneužitím (rate-limit)", region: "EÚ" },
    { name: "Google (Gemini)", purpose: "voliteľné AI funkcie", region: "EÚ / USA" },
  ],
} as const

/** Effective date shown on legal pages (update on material changes). */
export const LEGAL_EFFECTIVE_DATE = "5. 7. 2026"
