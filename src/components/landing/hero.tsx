"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTypewriter } from "./use-typewriter"
import { SITE } from "@/lib/site"

/**
 * Hero úvodnej stránky — text nad videom s postavou.
 *
 * Rozvrhnutie je z návrhu: rozmazaný úvodný riadok, pod ním písací efekt
 * a nakoniec pilulky. Obsah je náš — návrh hovoril za kreatívnu agentúru.
 */

const INTRO_1 = "Ahoj, toto je Synapse Faktúra."
const INTRO_2 = "Fakturácia, ktorá rozumie tvojim dokladom."

const TYPED =
  "Rád ťa vidím. Vystav faktúru, odfoť bloček, nechaj DPH na mne. Čo ideme robiť?"

const PILLS = [
  { label: "Vystaviť prvú faktúru", href: "/register" },
  { label: "Odfotiť bloček", href: "/register" },
  { label: "Pozrieť cenník", href: "#cennik" },
  { label: "Ako to funguje", href: "#funkcie" },
]

function CopyIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="3.5"
        y="3.5"
        width="7"
        height="7"
        rx="1.2"
        stroke="currentColor"
      />
      <path d="M8.5 1.5H2.2A1.2 1.2 0 0 0 1 2.7V9" stroke="currentColor" />
    </svg>
  )
}

export function Hero() {
  const { shown, done } = useTypewriter(TYPED)
  // Pilulky sa objavia nezávisle od písania. Keby čakali na dopísanie, prvá
  // výzva na akciu by prišla až po sekundách — presne tam, kde ľudia odchádzajú.
  const [pillsIn, setPillsIn] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setPillsIn(true), 400)
    return () => window.clearTimeout(id)
  }, [])

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(SITE.supportEmail)
      toast.success("Adresa skopírovaná.")
    } catch {
      // Bez HTTPS alebo bez povolenia schránka nie je — adresa je vidieť,
      // takže sa dá prepísať ručne.
      toast.error("Schránka nie je dostupná. Adresu prepíš ručne.")
    }
  }

  return (
    /*
     * `pb-28` na mobile nie je estetika: hero je tam zarovnaný dolu a cez spodok
     * beží lišta so súhlasom s cookies, ktorá inak prekryje poslednú pilulku.
     */
    <section className="relative z-1 flex h-screen flex-col justify-end overflow-hidden px-5 pb-28 sm:px-8 md:justify-center md:px-10 md:pb-0">
      <div className="relative z-10 max-w-xl">
        {/*
          Toto je JEDINÝ `h1` na stránke a je to zámer.
          Rozmazanie je vizuálna hra z návrhu, nie skrytie: text je v HTML,
          číta ho čítačka obrazovky aj vyhľadávač. Predtým tu bol `p`
          s `aria-hidden` a zdvojený `sr-only` text — stránka tak nemala ani
          jeden nadpis prvej úrovne, čo je oproti pôvodnému landingu krok späť.
        */}
        <h1
          className="font-heading mb-5 font-normal text-black select-none sm:mb-6"
          style={{
            fontSize: "clamp(18px, 4vw, 26px)",
            lineHeight: 1.3,
            filter: "blur(4px)",
          }}
        >
          {INTRO_1}
          <br />
          {INTRO_2}
        </h1>

        <p
          className="mb-5 text-black sm:mb-6"
          style={{
            fontSize: "clamp(18px, 4vw, 26px)",
            lineHeight: 1.35,
            minHeight: 54,
          }}
        >
          {/*
            Písaný text sa objaví až na klientovi. Aby stránka nebola bez neho
            prázdna (vyhľadávač bez JS, pomalé načítanie), leží tu aj ako
            neviditeľná kópia — po dopísaní je to presne ten istý text, takže
            sa nič nezdvojuje navonok.
          */}
          {!done && <span className="sr-only">{TYPED}</span>}
          <span aria-live="off">{shown}</span>
          {!done && (
            <span
              aria-hidden="true"
              className="ml-[2px] inline-block h-[1.1em] w-[2px] bg-black align-middle motion-safe:animate-[blink_1s_step-end_infinite]"
            />
          )}
        </p>

        <div
          className="flex flex-wrap gap-y-1"
          style={{
            opacity: pillsIn ? 1 : 0,
            transform: pillsIn ? "translateY(0)" : "translateY(8px)",
            transition: "opacity 0.4s ease, transform 0.4s ease",
          }}
        >
          {PILLS.map((pill) => (
            <Link
              key={pill.label}
              href={pill.href}
              className="mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-[0.3em] text-[13px] whitespace-nowrap text-black transition-colors duration-200 hover:bg-black hover:text-white sm:px-5 sm:text-[15px]"
            >
              {pill.label}
            </Link>
          ))}

          <button
            type="button"
            onClick={copyEmail}
            /*
             * Priehľadná pilulka, nie biela — odlišuje sa od ostatných tým, že
             * nemá výplň. V pôvodnom návrhu bola BIELA na tmavej časti videa;
             * naše video je svetlé, takže by bol biely text na svetlom podklade
             * a adresa by bola prakticky neviditeľná.
             */
            className="mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center gap-2 rounded-full border border-black/30 bg-transparent px-4 py-[0.3em] text-[13px] whitespace-nowrap text-black transition-colors duration-200 hover:bg-black hover:text-white sm:gap-3 sm:px-5 sm:text-[15px]"
          >
            <span>
              Napíš nám:{" "}
              <span className="underline underline-offset-1">
                {SITE.supportEmail}
              </span>
            </span>
            <CopyIcon />
          </button>
        </div>
      </div>
    </section>
  )
}
