"use client"

import { useEffect, useState } from "react"
import { useMediaQuery } from "./use-media-query"
import {
  TYPEWRITER_SPEED_MS,
  TYPEWRITER_START_DELAY_MS,
  revealedCount,
} from "@/lib/landing/typewriter"

/**
 * Postupné odhaľovanie textu.
 *
 * Počet znakov sa počíta zo skutočne uplynutého času (`performance.now()`),
 * nie pripočítavaním na každý tik. Pri prepnutí na inú kartu prehliadač
 * časovače spomalí — pripočítavanie by text nechalo v polovici, hoci
 * návštevník bol preč dosť dlho na to, aby dopísal.
 *
 * Kto má vypnuté animácie, dostane celý text hneď.
 */
export function useTypewriter(text: string): { shown: string; done: boolean } {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)")
  // Postup sa drží SPOLU s textom, ku ktorému patrí. Keby to bolo len číslo,
  // po zmene textu by ho bolo treba vynulovať v efekte — a nulovať stav
  // v efekte znamená vykresliť raz zle a hneď prekresliť.
  const [progress, setProgress] = useState({ text, count: 0 })
  const count = progress.text === text ? progress.count : 0

  useEffect(() => {
    if (reduced) return

    const started = performance.now()
    const id = window.setInterval(() => {
      const n = revealedCount(performance.now() - started, text.length)
      setProgress({ text, count: n })
      if (n >= text.length) window.clearInterval(id)
    }, TYPEWRITER_SPEED_MS)

    return () => window.clearInterval(id)
  }, [text, reduced])

  // Kto má vypnuté animácie, dostane text celý a hneď — počíta sa to pri
  // vykresľovaní, takže sa neprekresľuje zbytočne.
  const shownCount = reduced ? text.length : count
  return {
    shown: text.slice(0, shownCount),
    done: shownCount >= text.length,
  }
}

export { TYPEWRITER_START_DELAY_MS }
