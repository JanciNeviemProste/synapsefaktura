"use client"

import { useEffect, useState } from "react"

const DEADLINE = new Date("2027-01-01T00:00:00+01:00")

/** Days remaining until mandatory e-invoicing (client-side, avoids stale SSG). */
export function Countdown({ className }: { className?: string }) {
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    const update = () =>
      setDays(
        Math.max(0, Math.ceil((DEADLINE.getTime() - Date.now()) / 86_400_000)),
      )
    update()
    const id = setInterval(update, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className={className} aria-label="Počet dní do povinnej e-faktúry">
      {days === null ? "···" : days}
    </span>
  )
}
