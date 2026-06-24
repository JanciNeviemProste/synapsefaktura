/**
 * Client-safe provider catalog. Plain metadata only (no server-only imports), so
 * it can be consumed by the settings UI as well as the server-side resolver.
 * Real certified Digitálni poštári are added here once integrated (§5.5).
 */
export const POSTMAN_PROVIDERS: { value: string; label: string }[] = [
  { value: "mock", label: "Testovací (sandbox)" },
]
