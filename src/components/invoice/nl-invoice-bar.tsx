"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { draftInvoiceFromText } from "@/app/actions/ai-invoice"
import { useUpgrade } from "@/components/billing/upgrade-dialog"

export function NlInvoiceBar() {
  const router = useRouter()
  const { prompt } = useUpgrade()
  const [text, setText] = useState("")
  const [pending, startTransition] = useTransition()

  function submit() {
    const value = text.trim()
    if (!value) {
      toast.error("Najprv napíš, akú faktúru chceš vystaviť.")
      return
    }
    startTransition(async () => {
      const result = await draftInvoiceFromText(value)
      if (result.ok) {
        toast.success("Koncept faktúry je pripravený.")
        router.push(`/app/invoices/${result.id}/edit`)
        return
      }
      // Paywall má ponúknuť upgrade, nie tvrdiť, že appka je zle nastavená.
      if (result.upgrade) {
        prompt(result.upgrade, result.error)
        return
      }
      if (result.reason === "no_key") {
        toast.error(
          "AI nie je nakonfigurované. Vytvor faktúru ručne v editore nižšie.",
        )
        return
      }
      toast.error(result.error)
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2">
          <Sparkles className="text-muted-foreground size-4 shrink-0" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !pending) {
                e.preventDefault()
                submit()
              }
            }}
            disabled={pending}
            placeholder="Vystav faktúru jednou vetou…"
            aria-label="Vystav faktúru jednou vetou"
          />
        </div>
        <Button onClick={submit} disabled={pending} className="sm:w-auto">
          <Sparkles className="size-4" />
          {pending ? "Vytváram…" : "Vytvoriť koncept"}
        </Button>
      </CardContent>
    </Card>
  )
}
