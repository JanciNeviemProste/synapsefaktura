"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto grid max-w-5xl place-items-center py-24">
      <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-16 text-center">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="text-muted-foreground size-6" />
        </div>
        <div>
          <p className="font-medium">Niečo sa pokazilo</p>
          <p className="text-muted-foreground text-sm">
            Vyskytla sa neočakávaná chyba. Skús to prosím znova.
          </p>
        </div>
        <Button onClick={() => reset()}>Skúsiť znova</Button>
      </div>
    </div>
  )
}
