"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { writeOutcome } from "@/lib/supabase/affected"
import { getCurrentOrgId } from "@/lib/auth/current-org"
import type { Database } from "@/lib/supabase/database.types"
import {
  tagSchema,
  taggingSchema,
  taggableTypeSchema,
  type TagInput,
  type TaggingInput,
  type TaggableType,
} from "@/lib/validation/tag"

type Db = SupabaseClient<Database>
type TagRow = Database["public"]["Tables"]["tags"]["Row"]

export type TagActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/** Zoznam, ktory sa ma po zmene stitkov entity prekreslit. */
const TAGGABLE_PATHS: Record<TaggableType, string> = {
  document: "/app/invoices",
  expense: "/app/expenses",
  contact: "/app/contacts",
}

/** Postgres kod pre porusenie unikatneho indexu. */
const UNIQUE_VIOLATION = "23505"

/**
 * Overi, ze stitok patri organizacii. `taggings` vlastny `organization_id`
 * nema — bez tejto kontroly by sa dal cudzi stitok priradit vlastnej entite.
 */
async function tagInOrg(db: Db, orgId: string, tagId: string) {
  const { data } = await db
    .from("tags")
    .select("id")
    .eq("id", tagId)
    .eq("organization_id", orgId)
    .maybeSingle()
  return !!data
}

/**
 * Overi, ze stitkovana entita patri organizacii. Polymorfna vazba nevie mat
 * cudzi kluc, takze cielove ID kontrolujeme rucne v spravnej tabulke.
 */
async function targetInOrg(
  db: Db,
  orgId: string,
  type: TaggableType,
  id: string,
) {
  if (type === "document") {
    const { data } = await db
      .from("documents")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return !!data
  }
  if (type === "expense") {
    const { data } = await db
      .from("expenses")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return !!data
  }
  const { data } = await db
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle()
  return !!data
}

/**
 * Nazov je v DB jedinecny presne (case-sensitive), takze „Web" a „web" by
 * presli. Kontrolujeme bez ohladu na velkost pismen, aby zoznam nemal dvojicky.
 */
async function nameTaken(
  db: Db,
  orgId: string,
  name: string,
  excludeId?: string,
) {
  // Porovnavame v pameti, nie cez `ilike` — v nazve stitku moze byt `%` alebo
  // `_`, co su vo vzore zastupne znaky a hlasili by falosnu zhodu.
  const { data } = await db
    .from("tags")
    .select("id, name")
    .eq("organization_id", orgId)
  const needle = name.toLowerCase()
  return (data ?? []).some(
    (t) => t.id !== excludeId && t.name.toLowerCase() === needle,
  )
}

/** Stitky aktivnej organizacie. Prazdne pole, ak firma chyba. */
export async function listTags(): Promise<TagRow[]> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const { data } = await supabase
    .from("tags")
    .select("*")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })
  return data ?? []
}

/** Stitky priradene konkretnej entite. */
export async function listEntityTags(
  taggableType: TaggableType,
  taggableId: string,
): Promise<TagRow[]> {
  const parsedType = taggableTypeSchema.safeParse(taggableType)
  if (!parsedType.success) return []

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return []

  const { data: links } = await supabase
    .from("taggings")
    .select("tag_id")
    .eq("taggable_type", parsedType.data)
    .eq("taggable_id", taggableId)
  const tagIds = (links ?? []).map((l) => l.tag_id)
  if (tagIds.length === 0) return []

  // Filter na organizaciu je az tu — `taggings` stlpec pre firmu nema.
  const { data } = await supabase
    .from("tags")
    .select("*")
    .eq("organization_id", orgId)
    .in("id", tagIds)
    .order("name", { ascending: true })
  return data ?? []
}

export async function createTag(input: TagInput): Promise<TagActionResult> {
  const parsed = tagSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (await nameTaken(supabase, orgId, parsed.data.name)) {
    return { ok: false, error: "Štítok s týmto názvom už existuje." }
  }

  const { data, error } = await supabase
    .from("tags")
    .insert({
      organization_id: orgId,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "Štítok s týmto názvom už existuje." }
    }
    return { ok: false, error: "Štítok sa nepodarilo uložiť." }
  }

  revalidatePath("/app/settings")
  return { ok: true, id: data.id }
}

export async function updateTag(
  id: string,
  input: TagInput,
): Promise<TagActionResult> {
  const parsed = tagSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (await nameTaken(supabase, orgId, parsed.data.name, id)) {
    return { ok: false, error: "Štítok s týmto názvom už existuje." }
  }

  const { data, error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name, color: parsed.data.color ?? null })
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")
    .maybeSingle()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: "Štítok s týmto názvom už existuje." }
    }
    return { ok: false, error: "Štítok sa nepodarilo uložiť." }
  }
  if (!data) return { ok: false, error: "Štítok sa nenašiel." }

  revalidatePath("/app/settings")
  return { ok: true, id }
}

/** Zmazanie stitku odstrani aj vsetky jeho priradenia (FK on delete cascade). */
export async function deleteTag(id: string): Promise<TagActionResult> {
  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  // `.select("id")` je nutné: politika `tags_delete_admin` pustí len
  // owner/admin, ale PostgREST pri odfiltrovanom riadku vráti 204 bez chyby —
  // člen bez oprávnenia by inak dostal „Štítok zmazaný" a štítok by ostal.
  const { data, error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("id")

  const outcome = writeOutcome(error, data)
  if (outcome.kind === "failed") {
    return { ok: false, error: "Štítok sa nepodarilo zmazať." }
  }
  if (outcome.kind === "noRows") {
    const { data: visible } = await supabase
      .from("tags")
      .select("id")
      .eq("id", id)
      .eq("organization_id", orgId)
      .maybeSingle()
    return {
      ok: false,
      error: visible
        ? "Štítok môže zmazať len majiteľ alebo správca firmy."
        : "Štítok sa nenašiel.",
    }
  }

  revalidatePath("/app/settings")
  return { ok: true, id }
}

/** Priradi stitok entite. Opakovane priradenie je ticho v poriadku. */
export async function addTagging(
  input: TaggingInput,
): Promise<TagActionResult> {
  const parsed = taggingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const { tagId, taggableType, taggableId } = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (!(await tagInOrg(supabase, orgId, tagId))) {
    return { ok: false, error: "Štítok sa nenašiel." }
  }
  if (!(await targetInOrg(supabase, orgId, taggableType, taggableId))) {
    return { ok: false, error: "Záznam sa nenašiel." }
  }

  const { error } = await supabase
    .from("taggings")
    .insert({
      tag_id: tagId,
      taggable_type: taggableType,
      taggable_id: taggableId,
    })
  if (error && error.code !== UNIQUE_VIOLATION) {
    return { ok: false, error: "Štítok sa nepodarilo priradiť." }
  }

  revalidatePath(TAGGABLE_PATHS[taggableType])
  return { ok: true, id: tagId }
}

/** Odoberie stitok entite. */
export async function removeTagging(
  input: TaggingInput,
): Promise<TagActionResult> {
  const parsed = taggingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const { tagId, taggableType, taggableId } = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (!(await tagInOrg(supabase, orgId, tagId))) {
    return { ok: false, error: "Štítok sa nenašiel." }
  }

  const { error } = await supabase
    .from("taggings")
    .delete()
    .eq("tag_id", tagId)
    .eq("taggable_type", taggableType)
    .eq("taggable_id", taggableId)
  if (error) return { ok: false, error: "Štítok sa nepodarilo odobrať." }

  revalidatePath(TAGGABLE_PATHS[taggableType])
  return { ok: true, id: tagId }
}

/**
 * Nastavi presny zoznam stitkov entity — pre formulare, ktore stitky ukladaju
 * az spolu so zaznamom. Doplni chybajuce a odoberie prebytocne.
 */
export async function setEntityTags(
  taggableType: TaggableType,
  taggableId: string,
  tagIds: string[],
): Promise<TagActionResult> {
  const parsedType = taggableTypeSchema.safeParse(taggableType)
  if (!parsedType.success) return { ok: false, error: "Neplatný typ záznamu." }

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  if (!(await targetInOrg(supabase, orgId, parsedType.data, taggableId))) {
    return { ok: false, error: "Záznam sa nenašiel." }
  }

  // Cudzie stitky ticho vypadnu — do DB ide len to, co patri organizacii.
  let wanted = new Set<string>()
  if (tagIds.length > 0) {
    const { data: ownTags } = await supabase
      .from("tags")
      .select("id")
      .eq("organization_id", orgId)
      .in("id", tagIds)
    wanted = new Set((ownTags ?? []).map((t) => t.id))
  }

  const current = await listEntityTags(parsedType.data, taggableId)
  const currentIds = new Set(current.map((t) => t.id))

  const toAdd = [...wanted].filter((id) => !currentIds.has(id))
  const toRemove = [...currentIds].filter((id) => !wanted.has(id))

  if (toAdd.length > 0) {
    const { error } = await supabase.from("taggings").insert(
      toAdd.map((tagId) => ({
        tag_id: tagId,
        taggable_type: parsedType.data,
        taggable_id: taggableId,
      })),
    )
    if (error && error.code !== UNIQUE_VIOLATION) {
      return { ok: false, error: "Štítky sa nepodarilo uložiť." }
    }
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("taggings")
      .delete()
      .eq("taggable_type", parsedType.data)
      .eq("taggable_id", taggableId)
      .in("tag_id", toRemove)
    if (error) return { ok: false, error: "Štítky sa nepodarilo uložiť." }
  }

  revalidatePath(TAGGABLE_PATHS[parsedType.data])
  return { ok: true, id: taggableId }
}
