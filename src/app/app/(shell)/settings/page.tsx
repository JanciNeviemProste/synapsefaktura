import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { OrgSettings } from "@/components/settings/org-settings"
import { SequencesSettings } from "@/components/settings/sequences-settings"
import { BankAccountsSettings } from "@/components/settings/bank-accounts-settings"
import { TagsSettings } from "@/components/settings/tags-settings"
import { TravelRatesSettings } from "@/components/settings/travel-rates-settings"
import { EInvoiceSettings } from "@/components/settings/einvoice-settings"
import { BillingSettings } from "@/components/settings/billing-settings"
import { MembersSettings } from "@/components/settings/members-settings"
import { getOrganizationProfile } from "@/app/actions/org"
import { listBankAccounts } from "@/app/actions/bank-accounts"
import { listTags } from "@/app/actions/tags"
import { listTravelRates } from "@/app/actions/travel-rates"
import { getEInvoiceSettings } from "@/app/actions/einvoice-settings"
import { getBillingInfo } from "@/app/actions/billing"
import { listMembers, listPendingInvites } from "@/app/actions/members"
import { appBaseUrl } from "@/lib/billing/stripe"
import { planHasFeature } from "@/lib/billing/plans"

export const metadata = { title: "Nastavenia — Synapse Faktúra" }

export default async function SettingsPage() {
  const supabase = await createClient()

  // `orgId` sa zistuje SAMOSTATNE a pred zvyskom, lebo ho potrebuje filter na
  // `number_sequences`. Bez neho by sa cislovanie citalo len cez RLS — a ta
  // pusti vsetky organizacie, ktorych je pouzivatel clenom, takze clen dvoch
  // firiem by tu videl zmiesane rady oboch.
  const orgId = await getCurrentOrgId(supabase)

  const [
    { data: sequences },
    bankAccounts,
    tags,
    travelRates,
    orgProfile,
    einvoice,
    billing,
    members,
    invites,
    { data: user },
  ] = await Promise.all([
    orgId
      ? supabase
          .from("number_sequences")
          .select("*")
          .eq("organization_id", orgId)
          .order("year", { ascending: false })
          .order("doc_type")
      : Promise.resolve({ data: [] }),
    listBankAccounts(),
    listTags(),
    listTravelRates(),
    getOrganizationProfile(),
    getEInvoiceSettings(),
    getBillingInfo(),
    listMembers(),
    listPendingInvites(),
    supabase.auth.getUser(),
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

      <TravelRatesSettings rates={travelRates} />

      <SequencesSettings sequences={sequences ?? []} />
      {einvoice ? <EInvoiceSettings initial={einvoice} /> : null}
    </div>
  )
}
