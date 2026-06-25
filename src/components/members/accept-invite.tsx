"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { MailCheck } from "lucide-react"
import { toast } from "sonner"

import { acceptInvite } from "@/app/actions/members"
import { setActiveOrg } from "@/app/actions/preferences"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function accept() {
    startTransition(async () => {
      const res = await acceptInvite(token)
      if (!res.ok || !res.organizationId) {
        toast.error(res.error ?? "Pozvánku sa nepodarilo prijať.")
        return
      }
      await setActiveOrg(res.organizationId)
      toast.success("Pozvánka prijatá. Vitajte v tíme!")
      router.push("/app/dashboard")
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Pozvánka do tímu</CardTitle>
        <CardDescription>
          Boli ste pozvaní do firmy v Synapse Faktúra. Prijatím získate prístup k
          jej dokladom a nastaveniam.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <MailCheck className="text-muted-foreground size-6" />
        </div>
      </CardContent>
      <CardFooter>
        <Button type="button" onClick={accept} disabled={pending}>
          Prijať pozvánku
        </Button>
      </CardFooter>
    </Card>
  )
}
