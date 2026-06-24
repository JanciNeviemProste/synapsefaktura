"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  createOrganizationSchema,
  type CreateOrganizationInput,
} from "@/lib/validation/org"

export type CreateOrgResult = { error: string } | undefined

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
