"use client"

import { useSyncExternalStore } from "react"

/**
 * Odpoveď na media query, ktorá sa dá čítať priamo pri vykresľovaní.
 *
 * PREČO NIE `useState` + `useEffect`: `matchMedia` na serveri neexistuje, takže
 * sa hodnota dá zistiť až na klientovi. Zapísať ju cez `setState` v efekte
 * znamená vykresliť raz nesprávne a hneď prekresliť — a React Compiler to
 * (oprávnene) hlási ako chybu. `useSyncExternalStore` je presne na tento
 * prípad: má vlastnú serverovú vetvu a na zmenu média reaguje sám.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia?.(query).matches ?? false,
    // Na serveri nevieme nič — `false` je bezpečná odpoveď pre obe otázky,
    // ktoré sa tu pýtame (jemný ukazovateľ, obmedzený pohyb).
    () => false,
  )
}
