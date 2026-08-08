import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Stránka sa nenašla — Synapse Faktúra" }

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-muted-foreground text-5xl font-semibold tabular-nums">
          404
        </p>
        <div>
          <h1 className="font-heading text-[clamp(20px,3vw,28px)] tracking-tight">
            Stránka sa nenašla
          </h1>
          <p className="text-muted-foreground text-sm">
            Stránku, ktorú hľadáš, sa nepodarilo nájsť.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/dashboard">Späť na prehľad</Link>
        </Button>
      </div>
    </div>
  )
}
