"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const KEY = "cookie-notice-dismissed"
const EVENT = "cookie-notice-change"

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

function getSnapshot(): "1" | "0" {
  try {
    return localStorage.getItem(KEY) ? "1" : "0"
  } catch {
    return "1" // if storage is unavailable, don't nag
  }
}

// Hidden during SSR; the client resolves the real value via getSnapshot.
const getServerSnapshot = (): "1" | "0" => "1"

/**
 * Minimal informational cookie notice. The app uses only functional cookies
 * (auth/locale/theme). Uses useSyncExternalStore so there is no setState-in-effect
 * and no hydration flash for users who already dismissed it.
 */
export function CookieNotice() {
  const dismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )
  if (dismissed === "1") return null

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1")
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event(EVENT))
  }

  return (
    <div className="bg-background/95 fixed inset-x-0 bottom-0 z-50 border-t px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-sm sm:flex-row sm:justify-between">
        <p className="text-muted-foreground text-center sm:text-left">
          Používame len nevyhnutné cookies potrebné na fungovanie služby.{" "}
          <Link href="/cookies" className="text-primary underline">
            Viac o cookies
          </Link>
          .
        </p>
        <Button size="sm" onClick={dismiss} className="shrink-0">
          Rozumiem
        </Button>
      </div>
    </div>
  )
}
