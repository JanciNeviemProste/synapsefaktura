"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

/**
 * Floating switcher between landing design studies (V0 = current landing "/",
 * V1–V6 = /v1…/v6). Renders only on those routes; neutral dark pill so it
 * works on light and dark variants alike.
 */
const VERSIONS = [
  { label: "V0", href: "/" },
  { label: "V1", href: "/v1" },
  { label: "V2", href: "/v2" },
  { label: "V3", href: "/v3" },
  { label: "V4", href: "/v4" },
  { label: "V5", href: "/v5" },
  { label: "V6", href: "/v6" },
]

export function DesignSwitcher() {
  const pathname = usePathname()
  if (!VERSIONS.some((v) => v.href === pathname)) return null

  return (
    <nav
      aria-label="Prepínač dizajnových verzií"
      className="fixed right-4 bottom-20 z-50 flex items-center gap-1 rounded-full bg-neutral-900/90 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
    >
      <span className="mr-1 hidden font-medium text-neutral-400 select-none sm:inline">
        Dizajn
      </span>
      {VERSIONS.map((v) => {
        const active = v.href === pathname
        return (
          <Link
            key={v.href}
            href={v.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-white px-2 py-1 font-bold text-neutral-900"
                : "rounded-full px-2 py-1 font-medium text-neutral-300 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            }
          >
            {v.label}
          </Link>
        )
      })}
    </nav>
  )
}
