import { redirect } from "next/navigation"
import { Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard"

export const metadata = { title: "Nastavenie firmy — Synapse Faktúra" }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .limit(1)
    .maybeSingle()

  if (membership) {
    redirect("/app/dashboard")
  }

  return (
    <div className="bg-muted/30 flex min-h-screen flex-col items-center px-4 py-12">
      <div className="mb-8 flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="text-primary size-5" />
        Synapse Faktúra
      </div>
      <div className="w-full max-w-xl">
        <OnboardingWizard />
      </div>
    </div>
  )
}
