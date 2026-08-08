/**
 * `systemOrgId` v AI vrstve zapina SERVICE-ROLE klienta — teda cestu, kde RLS
 * nekryje nic. Je urcena pre cron, kde niet session.
 *
 * Predtym tam stal len komentar "volajuci si to musi overit sam". Tieto testy
 * strazia, ze to uz kontroluje kod: ked session existuje a jej organizacia
 * nesedi, volanie sa odmietne.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const MOJA = "org-1"
const CUDZIA = "org-2"

/** Organizacia zo session. `null` = systemovy beh (cron), ziadna session. */
let sessionOrg: string | null = MOJA
/** Kolkokrat sa siahlo po service-role klientovi. */
let adminUses = 0

/**
 * Klient s tolkym, kolko `checkCostCap` a `logUsage` naozaj pouzivaju:
 * `from().select().eq().gte()` sa awaituje, `from().insert()` vracia `{ error }`.
 */
function fakeClient(kind: string) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    gte: async () => ({ data: [], error: null }),
    insert: async () => ({ error: null }),
  }
  return { __kind: kind, from: () => chain }
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => fakeClient("user"),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    adminUses += 1
    return fakeClient("admin")
  },
}))

vi.mock("@/lib/auth/current-org", () => ({
  getCurrentOrgId: async () => sessionOrg,
}))

// Bez klica sa AI vrstva degraduje skor, nez sa dostane ku gate-u — a prave
// gate je to, co testujeme.
vi.mock("@/lib/ai/provider", () => ({
  hasAiKey: () => true,
  aiBackend: () => "google",
  aiModel: () => ({}),
  AI_MODEL: "test-model",
}))

/** Plan gate aj strop nakladov nechame prejst — zaujima nas org resolution. */
vi.mock("@/lib/billing/gate", () => ({
  getOrgPlan: async () => "business",
  gateFeature: async () => ({ allowed: true }),
}))

vi.mock("@/lib/ai/budget", () => ({
  checkAiBudget: () => ({ withinBudget: true }),
  monthStartIso: () => "2026-08-01T00:00:00.000Z",
  nextTierAfter: () => null,
  sumUsageCost: () => 0,
}))

// `generateObject` sa nesmie dostat na rad, ked gate odmietne.
let modelCalls = 0
vi.mock("ai", () => ({
  generateObject: async () => {
    modelCalls += 1
    return { object: { ok: true }, usage: {} }
  },
  generateText: async () => {
    modelCalls += 1
    return { text: "x", usage: {} }
  },
  stepCountIs: () => null,
}))

beforeEach(() => {
  sessionOrg = MOJA
  adminUses = 0
  modelCalls = 0
})

const { generateStructured } = await import("@/lib/ai/generate")

// Minimalna schema — `generateObject` je aj tak zamockovany.
const schema = { parse: (v: unknown) => v } as never

describe("systemOrgId vs. session", () => {
  it("cudzie systemOrgId pri prihlásenom používateľovi odmietne", async () => {
    sessionOrg = MOJA

    const res = await generateStructured({
      feature: "nl_invoice",
      schema,
      prompt: "x",
      systemOrgId: CUDZIA,
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe("org_unknown")
    // A hlavne: model sa nezavolal, takze sa nic cudzie ani nezauctovalo.
    expect(modelCalls).toBe(0)
  })

  it("vlastné systemOrgId prejde", async () => {
    sessionOrg = MOJA

    const res = await generateStructured({
      feature: "nl_invoice",
      schema,
      prompt: "x",
      systemOrgId: MOJA,
    })

    expect(res.ok).toBe(true)
    expect(adminUses).toBeGreaterThan(0)
  })

  it("cron bez session smie systemOrgId použiť", async () => {
    // Toto je dovod, preco ta cesta vobec existuje — upomienky bezia bez session.
    sessionOrg = null

    const res = await generateStructured({
      feature: "reminder",
      schema,
      prompt: "x",
      systemOrgId: CUDZIA,
    })

    expect(res.ok).toBe(true)
    expect(adminUses).toBeGreaterThan(0)
  })

  it("bez systemOrgId ide cez session a service role nepoužije", async () => {
    sessionOrg = MOJA

    const res = await generateStructured({
      feature: "nl_invoice",
      schema,
      prompt: "x",
    })

    expect(res.ok).toBe(true)
    expect(adminUses).toBe(0)
  })

  it("bez session a bez systemOrgId odmietne (fail-closed)", async () => {
    sessionOrg = null

    const res = await generateStructured({
      feature: "nl_invoice",
      schema,
      prompt: "x",
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.reason).toBe("org_unknown")
    expect(modelCalls).toBe(0)
  })
})
