import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { OrgSettings } from "@/components/settings/org-settings"
import { SequencesSettings } from "@/components/settings/sequences-settings"
import { BankAccountsSettings } from "@/components/settings/bank-accounts-settings"
import { TagsSettings } from "@/components/settings/tags-settings"
import { EInvoiceSettings } from "@/components/settings/einvoice-settings"
import { BillingSettings } from "@/components/settings/billing-settings"
import { MembersSettings } from "@/components/settings/members-settings"
import { getOrganizationProfile } from "@/app/actions/org"
import { listBankAccounts } from "@/app/actions/bank-accounts"
import { listTags } from "@/app/actions/tags"
import { getEInvoiceSettings } from "@/app/actions/einvoice-settings"
import { getBillingInfo } from "@/app/actions/billing"
import { listMembers, listPendingInvites } from "@/app/actions/members"
import { appBaseUrl } from "@/lib/billing/stripe"
import { planHasFeature } from "@/lib/billing/plans"

export const metadata = { title: "Nastavenia — Synapse Faktúra" }

export default async function SettingsPage() {
  const supabase = await createClient()

  const [
    { data: sequences },
    bankAccounts,
    tags,
    orgProfile,
    einvoice,
    billing,
    members,
    invites,
    { data: user },
    orgId,
  ] = await Promise.all([
    supabase
      .from("number_sequences")
      .select("*")
      .order("year", { ascending: false })
      .order("doc_type"),
    listBankAccounts(),
    listTags(),
    getOrganizationProfile(),
    getEInvoiceSettings(),
    getBillingInfo(),
    listMembers(),
    listPendingInvites(),
    supabase.auth.getUser(),
    getCurrentOrgId(supabase),
  ])

  // Caller's role in the active org → who may manage the team.
  let canManage = false
  if (user.user && orgId) {
    const { data: me } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.user.id)
      .maybeSingle()
    canManage = me?.role === "owner" || me?.role === "admin"
  }

  const multiUserEnabled = billing
    ? planHasFeature(billing.plan, "multiUser")
    : false

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Nastavenia</h1>
        <p className="text-muted-foreground text-sm">
          Firemné údaje, predplatné, tím, číselné rady a e-fakturácia.
        </p>
      </div>

      {orgProfile ? (
        <OrgSettings initial={orgProfile} canManage={canManage} />
      ) : null}

      {billing ? <BillingSettings initial={billing} /> : null}

      <MembersSettings
        initialMembers={members}
        initialInvites={invites}
        canManage={canManage}
        multiUserEnabled={multiUserEnabled}
        appUrl={appBaseUrl()}
      />

      <BankAccountsSettings accounts={bankAccounts} />

      <TagsSettings tags={tags} />

      <SequencesSettings sequences={sequences ?? []} />
      {einvoice ? <EInvoiceSettings initial={einvoice} /> : null}
    </div>
  )
}
