"use client"

import { useEffect, useRef } from "react"
import { nextScrubTime, isSeekWorthwhile } from "@/lib/landing/scrub"
import { useMediaQuery } from "./use-media-query"

/**
 * Postava na pozadí úvodnej stránky, ovládaná pohybom myši.
 *
 * Na myši sa video **neprehráva** — pretáča sa podľa vodorovného pohybu, takže
 * postava reaguje na to, čo návštevník robí. Na dotykovom zariadení taký vstup
 * neexistuje, tam by video navždy zamrzlo na prvom snímku, preto sa pustí ako
 * tichá slučka. Kto má vypnuté animácie, dostane jeden statický snímok.
 *
 * Video je NÁŠ súbor v `public/hero/`. Pôvodný návrh odkazoval na cudziu CDN
 * (4,5 MB, 3828×2164, jediný kľúčový snímok na celý klip) — v tej podobe by
 * pretáčanie sekalo, lebo každý posun dozadu znamená dekódovať od začiatku.
 * Náš súbor má 1920 px, 1,7 MB a kľúčový snímok každých 5 snímkov.
 */

const SRC = "/hero/aria.mp4"
const POSTER = "/hero/aria-poster.jpg"

type Mode = "scrub" | "loop" | "still"

export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  // Hrubý ukazovateľ = prst. Tam `mousemove` nepríde a pretáčanie by nefungovalo,
  // takže video by navždy stálo na prvom snímku.
  const finePointer = useMediaQuery("(pointer: fine)")

  const mode: Mode = reducedMotion ? "still" : finePointer ? "scrub" : "loop"

  useEffect(() => {
    const video = ref.current
    if (!video || mode !== "scrub") return

    let prevX: number | null = null
    // Východisko je tam, kde video naozaj stojí. Keby sa začínalo od nuly,
    // prvý pohyb myšou by obraz skokom prehodil inam než tam, kde bol.
    let target = Number.isFinite(video.currentTime) ? video.currentTime : 0
    let seeking = false

    function applySeek() {
      const el = ref.current
      if (!el || seeking) return
      if (!isSeekWorthwhile(el.currentTime, target)) return
      seeking = true
      el.currentTime = target
    }

    function handleSeeked() {
      seeking = false
      // Kým sme seekovali, myš sa mohla posunúť ďalej — dobehneme to až teraz.
      // Bez toho by rýchly pohyb skončil na starej pozícii.
      applySeek()
    }

    function handleMove(event: MouseEvent) {
      const el = ref.current
      if (!el) return
      if (prevX === null) {
        prevX = event.clientX
        return
      }
      const delta = event.clientX - prevX
      prevX = event.clientX
      target = nextScrubTime(target, delta, window.innerWidth, el.duration)
      applySeek()
    }

    video.addEventListener("seeked", handleSeeked)
    window.addEventListener("mousemove", handleMove, { passive: true })
    return () => {
      video.removeEventListener("seeked", handleSeeked)
      window.removeEventListener("mousemove", handleMove)
    }
  }, [mode])

  useEffect(() => {
    const video = ref.current
    if (!video || mode !== "loop") return
    // `play()` vracia prísľub, ktorý sa pri zamietnutí autoplay odmietne —
    // neošetrený by skončil ako chyba v konzole. Poster ostane a nič sa nedeje.
    void video.play().catch(() => {})
  }, [mode])

  return (
    <div className="fixed inset-0 z-0 bg-white">
      <video
        ref={ref}
        className="h-full w-full object-cover"
        style={{ objectPosition: "70% center" }}
        src={mode === "still" ? undefined : SRC}
        poster={POSTER}
        muted
        playsInline
        loop={mode === "loop"}
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  )
}
