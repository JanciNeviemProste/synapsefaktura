"use client"

import Link from "next/link"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { signIn, resendConfirmation } from "@/app/actions/auth"
import { GoogleButton } from "./google-button"

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations("auth")
  const [pending, startTransition] = useTransition()
  const [resending, startResend] = useTransition()
  // Nepotvrdený účet je slepá ulička: heslo je správne, ale dnu to nepustí.
  // Preto sa ponuka poslať potvrdenie znova zobrazí až vtedy, keď na ňu naozaj
  // došlo — nie ako trvalý odkaz, ktorý by mätol každého ostatného.
  const [unconfirmed, setUnconfirmed] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  function action(formData: FormData) {
    startTransition(async () => {
      const result = await signIn(formData)
      if (!result?.error) return
      setUnconfirmed(Boolean(result.unconfirmedEmail))
      toast.error(result.error)
    })
  }

  function handleResend() {
    const form = formRef.current
    if (!form) return
    const data = new FormData(form)
    startResend(async () => {
      const res = await resendConfirmation(data)
      if (res && "error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Potvrdzovací e-mail sme poslali znova. Pozri si schránku.")
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {googleEnabled && (
          <>
            <GoogleButton />
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">
                {t("orEmail")}
              </span>
              <Separator className="flex-1" />
            </div>
          </>
        )}
        <form ref={formRef} action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ty@firma.sk"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("signingIn") : t("signIn")}
          </Button>
        </form>

        {unconfirmed && (
          <div className="bg-muted/40 grid gap-2 rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">
              Účet existuje, len ešte nie je potvrdený. Heslo máš správne —
              chýba len klik na odkaz z e-mailu.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? "Posielam…" : "Poslať potvrdenie znova"}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground justify-center text-sm">
        {t("noAccount")}{" "}
        <Link
          href="/register"
          className="text-primary ml-1 font-medium hover:underline"
        >
          {t("register")}
        </Link>
      </CardFooter>
    </Card>
  )
}
