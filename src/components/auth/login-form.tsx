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
import { signIn } from "@/app/actions/auth"
import { GoogleButton } from "./google-button"

export function LoginForm() {
  const t = useTranslations("auth")
  const [pending, startTransition] = useTransition()

  function action(formData: FormData) {
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) toast.error(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginSubtitle")}</CardDescription>
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
