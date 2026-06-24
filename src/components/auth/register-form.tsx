"use client"

import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"
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
        <CardTitle>Vytvor si účet</CardTitle>
        <CardDescription>
          Začni zadarmo. Pripravený na e-faktúru 2027.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <GoogleButton />
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-xs">alebo e-mailom</span>
          <Separator className="flex-1" />
        </div>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Meno</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              placeholder="Ján Stáš"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
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
            <Label htmlFor="password">Heslo</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="aspoň 6 znakov"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Vytváram účet…" : "Zaregistrovať sa"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-muted-foreground justify-center text-sm">
        Máš už účet?{" "}
        <Link
          href="/login"
          className="text-primary ml-1 font-medium hover:underline"
        >
          Prihlás sa
        </Link>
      </CardFooter>
    </Card>
  )
}
