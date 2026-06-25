import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import sk from "../../messages/sk.json"
import cz from "../../messages/cz.json"
import en from "../../messages/en.json"

export const LOCALES = ["sk", "cz", "en"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "sk"
export const LOCALE_COOKIE = "locale"

const CATALOG: Record<Locale, Record<string, unknown>> = { sk, cz, en }

/** Deep-merge a locale's messages over the SK base so missing CZ/EN keys fall
 *  back to Slovak rather than throwing. */
function withFallback(locale: Locale): Record<string, unknown> {
  if (locale === "sk") return sk
  return deepMerge(sk, CATALOG[locale])
}

function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over)) {
    const b = out[k]
    if (
      b &&
      typeof b === "object" &&
      !Array.isArray(b) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = deepMerge(
        b as Record<string, unknown>,
        v as Record<string, unknown>,
      )
    } else if (v !== undefined && v !== "") {
      out[k] = v
    }
  }
  return out
}

export default getRequestConfig(async () => {
  const store = await cookies()
  const raw = store.get(LOCALE_COOKIE)?.value
  const locale: Locale = (LOCALES as readonly string[]).includes(raw ?? "")
    ? (raw as Locale)
    : DEFAULT_LOCALE

  return { locale, messages: withFallback(locale) }
})
