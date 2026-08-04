"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
  type UpdateOrganizationValues,
} from "@/lib/validation/org"

export type CreateOrgResult = { error: string } | undefined

export type OrgActionResult = { ok: true } | { ok: false; error: string }

/** Firemny profil v tvare, ktory formular v nastaveniach berie ako default. */
export type OrganizationProfile = UpdateOrganizationValues

/** Prazdny retazec z formulara -> NULL v nullable stlpci. */
function orNull(value: string): string | null {
  return value === "" ? null : value
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<CreateOrgResult> {
  const parsed = createOrganizationSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Nie si prihlásený." }
  }

  const { error } = await supabase.rpc("create_organization_with_owner", {
    p_name: v.name,
    p_legal_form: v.legalForm ?? undefined,
    p_ico: v.ico ?? undefined,
    p_dic: v.dic ?? undefined,
    p_ic_dph: v.icDph ?? undefined,
    p_is_vat_payer: v.isVatPayer,
    p_vat_mode_default: v.vatModeDefault,
    p_street: v.street ?? undefined,
    p_city: v.city ?? undefined,
    p_postal_code: v.postalCode ?? undefined,
    p_country: v.country,
    p_default_currency: v.defaultCurrency,
    p_default_language: v.defaultLanguage,
    p_default_due_days: v.defaultDueDays,
    p_iban: v.iban ?? undefined,
    p_swift: v.swift ?? undefined,
    p_bank_name: v.bankName ?? undefined,
  })
  if (error) {
    return { error: "Firmu sa nepodarilo vytvoriť. Skús to znova." }
  }

  revalidatePath("/app", "layout")
  redirect("/app/dashboard")
}

/** Nacita firemny profil aktivnej organizacie. Vrati null, ak firma nie je. */
export async function getOrganizationProfile(): Promise<OrganizationProfile | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return null

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "name, legal_form, ico, dic, ic_dph, is_vat_payer, vat_mode_default, street, city, postal_code, country, default_currency, default_language, default_due_days",
    )
    .eq("id", orgId)
    .maybeSingle()

  if (!org) return null

  return {
    name: org.name,
    legalForm: org.legal_form ?? "",
    ico: org.ico ?? "",
    dic: org.dic ?? "",
    icDph: org.ic_dph ?? "",
    isVatPayer: org.is_vat_payer,
    vatModeDefault: org.vat_mode_default,
    street: org.street ?? "",
    city: org.city ?? "",
    postalCode: org.postal_code ?? "",
    country: org.country,
    defaultCurrency: org.default_currency,
    defaultLanguage: org.default_language,
    defaultDueDays: org.default_due_days,
  }
}

/**
 * Upravi firemny profil aktivnej organizacie. Meni sa VYLUCNE organizacia, ktorej
 * je volajuci clenom (`getCurrentOrgId` + `.eq("id", orgId)`) — samotna RLS by
 * pustila kazdu organizaciu, v ktorej ma pouzivatel clenstvo. Navyse rolovy guard:
 * firemne udaje smie menit len owner/admin (rovnaky vzor ako billing/members).
 */
export async function updateOrganization(
  input: UpdateOrganizationInput,
): Promise<OrgActionResult> {
  const parsed = updateOrganizationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Nie si prihlásený." }

  const { data: me } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (me?.role !== "owner" && me?.role !== "admin") {
    return {
      ok: false,
      error: "Firemné údaje môže meniť len vlastník alebo administrátor.",
    }
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name: v.name,
      legal_form: orNull(v.legalForm),
      ico: orNull(v.ico),
      dic: orNull(v.dic),
      ic_dph: orNull(v.icDph),
      is_vat_payer: v.isVatPayer,
      vat_mode_default: v.vatModeDefault,
      street: orNull(v.street),
      city: orNull(v.city),
      postal_code: orNull(v.postalCode),
      country: v.country,
      default_currency: v.defaultCurrency,
      default_language: v.defaultLanguage,
      default_due_days: v.defaultDueDays,
    })
    .eq("id", orgId)

  if (error) {
    return { ok: false, error: "Firemné údaje sa nepodarilo uložiť." }
  }

  revalidatePath("/app/settings")
  revalidatePath("/app/dashboard")
  return { ok: true }
}
