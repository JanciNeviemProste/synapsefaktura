"use client"

import Link from "next/link"
import { useState } from "react"

/**
 * Navigácia úvodnej stránky.
 *
 * Sedí NAD videom, takže je celá čierna na priehľadnom pozadí — video je
 * svetlé a text sa naň číta. Na mobile sa odkazy schovajú za hamburger,
 * ktorý sa po otvorení zmení na krížik.
 *
 * ⚠️ Symbol ® z pôvodného návrhu tu zámerne NIE JE. Značka Synapse Faktúra
 * registrovaná nie je a ® je tvrdenie o registrovanej ochrannej známke —
 * dekoratívne to vyzerá dobre, ale nesedelo by to.
 */

const LINKS = [
  { label: "Funkcie", href: "#funkcie" },
  { label: "Cenník", href: "#cennik" },
  { label: "e-Faktúra 2027", href: "/e-faktura-2027" },
  { label: "Kontakt", href: "/kontakt" },
]

export function LandingNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="flex items-center gap-3 text-black">
          <span className="font-heading text-[21px] tracking-tight sm:text-[26px]">
            Synapse Faktúra
          </span>
          <span
            aria-hidden="true"
            className="text-[25px] select-none sm:text-[30px]"
            style={{ letterSpacing: "-0.02em" }}
          >
            ✳︎
          </span>
        </Link>

        <nav className="hidden items-center text-[23px] text-black md:flex">
          {LINKS.map((link, i) => (
            <span key={link.href}>
              <Link
                href={link.href}
                className="transition-opacity hover:opacity-60"
              >
                {link.label}
              </Link>
              {i < LINKS.length - 1 ? <span>,&nbsp;</span> : null}
            </span>
          ))}
        </nav>

        <Link
          href="/register"
          className="hidden text-[23px] text-black underline underline-offset-2 transition-opacity hover:opacity-60 md:block"
        >
          Vyskúšať zadarmo
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Zavrieť menu" : "Otvoriť menu"}
          aria-expanded={open}
          className="flex flex-col gap-[5px] md:hidden"
        >
          <span
            className={`h-[2px] w-6 bg-black transition-all duration-300 ${
              open ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`h-[2px] w-6 bg-black transition-all duration-300 ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-[2px] w-6 bg-black transition-all duration-300 ${
              open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </button>
      </header>

      <div
        className={`fixed inset-0 z-9 flex flex-col justify-center gap-8 bg-white/95 px-8 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className="text-[32px] font-medium text-black"
          >
            {link.label}
          </Link>
        ))}
        <Link
          href="/register"
          onClick={() => setOpen(false)}
          className="text-[32px] font-medium text-black underline underline-offset-2"
        >
          Vyskúšať zadarmo
        </Link>
      </div>
    </>
  )
}
