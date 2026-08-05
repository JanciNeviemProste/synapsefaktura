"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeOutcome } from "@/lib/supabase/affected"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import { ATTACHMENTS_BUCKET } from "@/lib/storage/buckets"
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
 * Cesty k firemnym obrazkom. Zamerne SAMOSTATNE od `getOrganizationProfile`:
 * ten vracia hodnoty pre formular s textovymi polami, kym obrazky sa nahravaju
 * po jednom a s formularom sa neukladaju.
 */
export async function getOrganizationBranding(): Promise<{
  logoUrl: string | null
  signatureUrl: string | null
  stampUrl: string | null
} | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return null

  const { data } = await supabase
    .from("organizations")
    .select("logo_url, signature_url, stamp_url")
    .eq("id", orgId)
    .maybeSingle()
  if (!data) return null

  return {
    logoUrl: data.logo_url,
    signatureUrl: data.signature_url,
    stampUrl: data.stamp_url,
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

  // `.select("id")` nie je kozmetika: PostgREST pri zapise odfiltrovanom RLS
  // nevrati chybu, len nezmeni ziadny riadok — pouzivatel by dostal hlasku
  // o ulozeni a udaje by ostali stare.
  const { data: updated, error } = await supabase
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
    .select("id")

  const outcome = writeOutcome(error, updated)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Firemné údaje sa nepodarilo uložiť." }
  }
  if (outcome.kind === "noRows") {
    return { ok: false, error: "Firma sa nenašla." }
  }

  revalidatePath("/app/settings")
  revalidatePath("/app/dashboard")
  return { ok: true }
}

/** Ktorý firemný obrázok sa nahráva. */
export type BrandingImage = "logo" | "signature" | "stamp"

const BRANDING_LABEL: Record<BrandingImage, string> = {
  logo: "Logo",
  signature: "Podpis",
  stamp: "Pečiatka",
}

/**
 * Zápis do správneho stĺpca. Vypísané po jednom zámerne: dynamický kľúč
 * (`{ [column]: value }`) TypeScript proti typom Supabase neoverí, takže by
 * preklep v názve stĺpca prešiel prekladom a zlyhal až za behu.
 */
function brandingUpdate(kind: BrandingImage, value: string | null) {
  switch (kind) {
    case "logo":
      return { logo_url: value }
    case "signature":
      return { signature_url: value }
    case "stamp":
      return { stamp_url: value }
  }
}

/** Aktuálna cesta k obrázku danej firmy, alebo `null`. */
async function currentBrandingPath(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  kind: BrandingImage,
): Promise<string | null> {
  const { data } = await supabase
    .from("organizations")
    .select("logo_url, signature_url, stamp_url")
    .eq("id", orgId)
    .maybeSingle()
  if (!data) return null
  if (kind === "logo") return data.logo_url
  if (kind === "signature") return data.signature_url
  return data.stamp_url
}

/**
 * Overí, že volajúci smie meniť firemné údaje, a vráti id organizácie.
 *
 * Ten istý guard ako `updateOrganization`. Logo a najmä PODPIS firmy nie sú
 * vec, ktorú má meniť hocijaký člen. Pri prílohe nákladu guard zámerne nie je
 * — tam ide o doklad, ktorý člen aj tak zadáva.
 */
async function requireOrgManager(): Promise<
  { ok: true; orgId: string } | { ok: false; error: string }
> {
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
  return { ok: true, orgId }
}

/**
 * Nahrá logo, podpis alebo pečiatku firmy.
 *
 * Ukladá sa do SÚKROMNÉHO bucketu pod `{orgId}/branding/…`. Verejný bucket by
 * pri podpise a pečiatke bol chyba — verejná adresa obrázku podpisu je návod
 * na falšovanie. PDF si súbor stiahne service-role klientom priamo pri
 * generovaní (`lib/pdf/render.tsx`).
 *
 * Súbor sem už príde NAHRATÝ — prehliadač ho poslal priamo do úložiska
 * (`lib/upload/direct.ts`), lebo cez server action by sa väčší nedostal
 * (Vercel má strop 4,5 MB). Formát aj veľkosť overil `verifyUpload` predtým,
 * než sa sem cesta dostala; tu sa už len zapíše a upratá predchádzajúci súbor.
 */
export async function setBrandingImage(
  kind: BrandingImage,
  path: string,
): Promise<OrgActionResult> {
  const guard = await requireOrgManager()
  if (!guard.ok) return guard
  const { orgId } = guard

  // Cesta MUSI patrit tejto firme. Bez toho by si clen jednej firmy nastavil
  // ako logo subor druhej — cestu posiela klient.
  if (!path.startsWith(`${orgId}/`)) {
    return { ok: false, error: "Súbor sa nenašiel." }
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const oldPath = await currentBrandingPath(supabase, orgId, kind)

  const { data: saved, error } = await supabase
    .from("organizations")
    .update(brandingUpdate(kind, path))
    .eq("id", orgId)
    .select("id")
  const outcome = writeOutcome(error, saved)
  if (outcome.kind !== "ok") {
    // Zapis do DB zlyhal, tak po sebe upraceme — inak by v buckete zostal
    // subor, na ktory sa uz nikto neodkaze.
    await admin.storage.from(ATTACHMENTS_BUCKET).remove([path])
    return { ok: false, error: `${BRANDING_LABEL[kind]} sa nepodarilo uložiť.` }
  }

  // Stary subor uz nikto necita. Bez tohto by kazde nove logo nechalo to
  // predchadzajuce navzdy v uloziske.
  if (oldPath && oldPath !== path && !/^https?:\/\//i.test(oldPath)) {
    await admin.storage.from(ATTACHMENTS_BUCKET).remove([oldPath])
  }

  revalidatePath("/app/settings")
  revalidatePath("/app/dashboard")
  return { ok: true }
}

/** Odstráni firemný obrázok — z databázy aj z úložiska. */
export async function removeOrgImage(
  kind: BrandingImage,
): Promise<OrgActionResult> {
  const guard = await requireOrgManager()
  if (!guard.ok) return guard
  const { orgId } = guard

  const supabase = await createClient()
  const path = await currentBrandingPath(supabase, orgId, kind)

  const { data: saved, error } = await supabase
    .from("organizations")
    .update(brandingUpdate(kind, null))
    .eq("id", orgId)
    .select("id")
  const outcome = writeOutcome(error, saved)
  if (outcome.kind !== "ok") {
    return { ok: false, error: `${BRANDING_LABEL[kind]} sa nepodarilo odstrániť.` }
  }

  if (path && !/^https?:\/\//i.test(path)) {
    await createAdminClient()
      .storage.from(ATTACHMENTS_BUCKET)
      .remove([path])
  }

  revalidatePath("/app/settings")
  revalidatePath("/app/dashboard")
  return { ok: true }
}

/**
 * Podpísaná adresa firemného obrázka na náhľad v Nastaveniach (10 minút).
 *
 * Prefix organizácie je to, čo bráni prezretiu cudzieho podpisu — rovnaká
 * poistka ako pri prílohách nákladov.
 */
export async function getBrandingSignedUrl(
  path: string,
): Promise<string | null> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId || !path.startsWith(`${orgId}/`)) return null

  const { data } = await createAdminClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60 * 10)
  return data?.signedUrl ?? null
}
