import { z } from "zod"

/**
 * Normalized company lookup result. Every registry provider (RPO, FinStat, …)
 * maps its raw response into this shape so the provider is swappable.
 */
export const companyLookupResultSchema = z.object({
  ico: z.string(),
  name: z.string(),
  legalForm: z.string().nullable(),
  dic: z.string().nullable(),
  icDph: z.string().nullable(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().default("SK"),
})

export type CompanyLookupResult = z.infer<typeof companyLookupResultSchema>

/** Slovak IČO: 6 or 8 digits. */
export const icoSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$|^\d{8}$/, "IČO musí mať 6 alebo 8 číslic.")

export interface CompanyRegistryProvider {
  /** Returns the company for an IČO, or null if not found. Throws on transport errors. */
  lookupByIco(ico: string): Promise<CompanyLookupResult | null>
}
