import "server-only"

import type { PostgrestError } from "@supabase/supabase-js"

/**
 * Vyhodnotenie zapisu, ktory sa mohol NETRAFIT do ziadneho riadku.
 *
 * PostgREST pri `update`/`delete`, ktory RLS odfiltruje, vrati 204 a `error`
 * je `null` — na nerozoznanie od uspesneho zapisu. Rovnako dopadne neexistujuce
 * id aj id cudzej firmy. Samotne `if (error)` teda nestaci: pouzivatel dostane
 * „Zmazane“ a riadok ostane.
 *
 * Odkedy maju niektore tabulky `for delete using (has_org_role(...))`, je to
 * bezny scenar — clen bez role owner/admin klikne na kos a nic sa nestane.
 *
 * Pouzitie vyzaduje `.select("id")` na konci dotazu, inak PostgREST riadky
 * nevracia a vysledok by bol vzdy `noRows`.
 */
export type WriteOutcome =
  | { kind: "ok" }
  /** Databaza vratila chybu. */
  | { kind: "failed" }
  /** Ziadny riadok: neexistuje, patri inej firme, alebo ho zamietla RLS. */
  | { kind: "noRows" }

export function writeOutcome(
  error: PostgrestError | null,
  rows: unknown[] | null,
): WriteOutcome {
  if (error) return { kind: "failed" }
  if (!rows || rows.length === 0) return { kind: "noRows" }
  return { kind: "ok" }
}
