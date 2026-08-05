import type { Metadata } from "next"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResendConfirmation } from "@/components/auth/resend-confirmation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Skontroluj e-mail — Synapse Faktúra",
}

export default async function RegistrationDonePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const email = (await searchParams).email ?? ""

  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <MailCheck className="text-primary size-10" />
          <CardTitle>Skontroluj si e-mail</CardTitle>
          <CardDescription>
            Poslali sme ti overovací odkaz. Klikni naň a dokonči registráciu —
            potom ťa prevedieme nastavením firmy.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-muted-foreground text-sm">
            E-mail nevidíš? Pozri sa do priečinka Spam. Registráciu neopakuj —
            účet už existuje a druhý pokus ju odmietne; namiesto toho si nechaj
            poslať potvrdenie znova.
          </p>
          {email ? <ResendConfirmation email={email} /> : null}
          <Button asChild variant="ghost">
            <Link href="/login">Prejsť na prihlásenie</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
