import "server-only"

import { RpoRegistryProvider } from "./rpo"
import type { CompanyLookupResult, CompanyRegistryProvider } from "./types"

export type { CompanyLookupResult } from "./types"
export { icoSchema } from "./types"

/**
 * Active registry provider. Swap here to move to FinStat or another source.
 */
const provider: CompanyRegistryProvider = new RpoRegistryProvider()

export function lookupCompanyByIco(
  ico: string,
): Promise<CompanyLookupResult | null> {
  return provider.lookupByIco(ico)
}
