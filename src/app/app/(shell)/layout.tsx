import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/app/sidebar"
import { UserMenu } from "@/components/app/user-menu"
import { OrgSwitcher } from "@/components/app/org-switcher"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { LocaleSwitcher } from "@/components/app/locale-switcher"
import { listMyOrganizations, getActiveOrgId } from "@/app/actions/preferences"

/**
 * The authenticated app shell (sidebar + topbar). Requires the user to belong to
 * at least one organization; otherwise routes to onboarding.
 */
export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .limit(1)
    .maybeSingle()

  if (!membership) {
    redirect("/app/onboarding")
  }

  const [{ data: profile }, orgs, activeOrgId] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    listMyOrganizations(),
    getActiveOrgId(),
  ])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="bg-background flex h-14 items-center justify-between gap-2 border-b px-4">
          <OrgSwitcher orgs={orgs} activeId={activeOrgId} />
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
            <UserMenu
              email={user.email ?? ""}
              name={profile?.display_name ?? null}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>
        </header>
        <main className="bg-muted/20 flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
