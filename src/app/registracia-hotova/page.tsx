import type { Metadata } from "next"
import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
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

export default function RegistrationDonePage() {
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
            E-mail nevidíš? Skontroluj priečinok Spam alebo skús registráciu znova.
          </p>
          <Button asChild variant="outline">
            <Link href="/login">Prejsť na prihlásenie</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
