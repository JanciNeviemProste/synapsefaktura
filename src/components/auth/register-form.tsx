"use client"

import Link from "next/link"
import { useTransition } from "react"
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
import { signUp } from "@/app/actions/auth"
import { GoogleButton } from "./google-button"

export function RegisterForm() {
  const t = useTranslations("auth")
  const [pending, startTransition] = useTransition()

  function action(formData: FormData) {
    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("registerTitle")}</CardTitle>
        <CardDescription>{t("registerSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <GoogleButton />
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">{t("orEmail")}</span>
          <Separator className="flex-1" />
        </div>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">{t("name")}</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              placeholder="Ján Stáš"
            />
          </div>
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
              autoComplete="new-password"
              placeholder={t("passwordHint")}
              required
            />
          </div>
          <label
            htmlFor="consent"
            className="text-muted-foreground flex items-start gap-2 text-xs"
          >
            <input
              id="consent"
              name="consent"
              type="checkbox"
              required
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              Súhlasím s{" "}
              <Link href="/podmienky" className="text-primary underline">
                obchodnými podmienkami
              </Link>{" "}
              a{" "}
              <Link
                href="/ochrana-osobnych-udajov"
                className="text-primary underline"
              >
                spracovaním osobných údajov
              </Link>
              .
            </span>
          </label>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("creatingAccount") : t("signUp")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-muted-foreground justify-center text-sm">
        {t("haveAccount")}{" "}
        <Link
          href="/login"
          className="text-primary ml-1 font-medium hover:underline"
        >
          {t("login")}
        </Link>
      </CardFooter>
    </Card>
  )
}
