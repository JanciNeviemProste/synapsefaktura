import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Auth guard for the whole /app area. Membership/org guard and the visual shell
 * live in (shell)/layout.tsx, so /app/onboarding renders without a sidebar.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <>{children}</>
}
