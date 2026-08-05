"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { resendConfirmation } from "@/app/actions/auth"

/**
 * Poslanie potvrdzovacieho e-mailu znova.
 *
 * Stránka po registrácii dovtedy radila „skús registráciu znova" — čo je zlá
 * rada: druhá registrácia na tú istú adresu skončí hláškou, že používateľ už
 * existuje, a človek zostane zaseknutý medzi dvomi protichodnými pokynmi.
 */
export function ResendConfirmation({ email }: { email: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const data = new FormData()
          data.set("email", email)
          const res = await resendConfirmation(data)
          if (res && "error" in res) {
            toast.error(res.error)
            return
          }
          toast.success("Potvrdzovací e-mail sme poslali znova.")
        })
      }
    >
      {pending ? "Posielam…" : "Poslať e-mail znova"}
    </Button>
  )
}
