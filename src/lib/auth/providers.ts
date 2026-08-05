import "server-only"

import { supabaseEnv } from "@/lib/supabase/env"

/**
 * Ktoré externé prihlásenia má projekt naozaj zapnuté.
 *
 * PREČO TO VÔBEC ZISŤUJEME: `supabase.auth.signInWithOAuth()` poskytovateľa
 * **neoveruje** — vždy vráti adresu a chybu ohlási až samotné Supabase, keď
 * tam prehliadač príde. Pri vypnutom Google to znamenalo, že používateľ klikol
 * na „Pokračovať cez Google“ a pristál na bielej stránke so surovým JSON-om:
 *
 *   {"code":400,"error_code":"validation_failed",
 *    "msg":"Unsupported provider: provider is not enabled"}
 *
 * Tlačidlo, ktoré nemôže fungovať, preto radšej vôbec neukazujeme. Zoznam sa
 * číta zo živého nastavenia projektu, takže v deň, keď sa Google v Supabase
 * zapne, sa tlačidlo objaví samo — netreba meniť ani riadok kódu.
 */

/** Ako dlho si držíme odpoveď, nech sa nepýtame pri každom zobrazení. */
const TTL_MS = 5 * 60 * 1000

/**
 * Mená zapnutých poskytovateľov z odpovede `/auth/v1/settings`.
 *
 * GoTrue vracia `external` ako mapu `{ google: false, github: false, … }`,
 * kde `email` a `phone` sú tiež v zozname. Tvar odpovede sa v minulosti menil,
 * takže sa naň nespoliehame a čokoľvek neočakávané znamená prázdny zoznam —
 * radšej tlačidlo neukázať než ukázať pokazené.
 */
export function parseEnabledProviders(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) return []
  const external = (payload as { external?: unknown }).external
  if (typeof external !== "object" || external === null) return []
  return Object.entries(external as Record<string, unknown>)
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => name)
}

let cache: { at: number; providers: string[] } | null = null

/** Zoznam zapnutých externých poskytovateľov; pri chybe prázdny. */
export async function enabledExternalProviders(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.providers

  const { url, anonKey, configured } = supabaseEnv()
  if (!configured) return []

  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey as string },
      // Nastavenie projektu sa nemení často, ale odpoveď sa nesmie zaseknúť
      // v cache Nextu naveky — vlastný TTL vyššie stačí.
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const providers = parseEnabledProviders(await res.json())
    cache = { at: Date.now(), providers }
    return providers
  } catch {
    // Nedostupné Supabase nesmie zhodiť prihlasovaciu stránku — e-mailom
    // a heslom sa prihlásiť dá aj tak.
    return []
  }
}

/** Má sa zobraziť tlačidlo „Pokračovať cez Google“? */
export async function isGoogleEnabled(): Promise<boolean> {
  return (await enabledExternalProviders()).includes("google")
}
