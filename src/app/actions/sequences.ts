"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCurrentOrgId } from "@/lib/auth/current-org"

const sequenceSchema = z.object({
  docType: z.enum([
    "invoice",
    "proforma",
    "advance",
    "tax_doc_payment",
    "credit_note",
    "quote",
    "order_issued",
    "order_received",
    "delivery_note",
    "draft",
  ]),
  year: z.coerce.number().int().min(2000).max(2100),
  prefix: z.string().trim().default(""),
  format: z.string().trim().min(1).default("{year}{seq}"),
  padding: z.coerce.number().int().min(1).max(10).default(4),
  nextNumber: z.coerce.number().int().min(1).default(1),
})

export type SequenceInput = z.input<typeof sequenceSchema>
export type SequenceActionResult = { ok: true } | { ok: false; error: string }

export async function upsertSequence(
  input: SequenceInput,
): Promise<SequenceActionResult> {
  const parsed = sequenceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const v = parsed.data

  const supabase = await createClient()
  const orgId = await getCurrentOrgId(supabase)
  if (!orgId) return { ok: false, error: "Chýba firma." }

  const { error } = await supabase.from("number_sequences").upsert(
    {
      organization_id: orgId,
      doc_type: v.docType,
      year: v.year,
      prefix: v.prefix,
      format: v.format,
      padding: v.padding,
      next_number: v.nextNumber,
    },
    { onConflict: "organization_id,doc_type,year" },
  )
  if (error) return { ok: false, error: "Číselný rad sa nepodarilo uložiť." }

  revalidatePath("/app/settings")
  return { ok: true }
}
