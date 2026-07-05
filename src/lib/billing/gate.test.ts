import { describe, it, expect, vi } from "vitest"

// gate.ts is server-only; neutralize the guard for unit testing.
vi.mock("server-only", () => ({}))

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  getOrgPlan,
  gateFeature,
  issuedThisMonth,
  gateDocumentIssue,
} from "./gate"

type Result = { data?: unknown; error?: unknown; count?: number | null }
type DB = SupabaseClient<Database>

/**
 * Minimal Supabase query-builder fake: every filter method chains, `.maybeSingle()`
 * resolves the table's configured result, and awaiting the builder itself resolves
 * it too (used by the count query). Result is keyed by table name.
 */
function fakeDb(perTable: Record<string, Result>): DB {
  const chain = ["select", "eq", "neq", "gte", "lte", "in", "not", "order", "limit"]
  return {
    from(table: string) {
      const result: Result = perTable[table] ?? { data: null, error: null }
      const builder: Record<string, unknown> = {}
      for (const m of chain) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve(result)
      builder.single = () => Promise.resolve(result)
      builder.then = (
        resolve: (v: Result) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject)
      return builder
    },
  } as unknown as DB
}

describe("getOrgPlan", () => {
  it("returns the org's plan", async () => {
    const db = fakeDb({ organizations: { data: { plan: "pro" } } })
    expect(await getOrgPlan(db, "o1")).toBe("pro")
  })

  it("defaults to free when missing or on error", async () => {
    expect(await getOrgPlan(fakeDb({ organizations: { data: null } }), "o1")).toBe(
      "free",
    )
    expect(
      await getOrgPlan(
        fakeDb({ organizations: { data: null, error: { message: "boom" } } }),
        "o1",
      ),
    ).toBe("free")
  })
})

describe("gateFeature", () => {
  it("allows a feature the plan grants", async () => {
    const db = fakeDb({ organizations: { data: { plan: "pro" } } })
    expect(await gateFeature(db, "o1", "aiCapture")).toEqual({ allowed: true })
  })

  it("denies a feature the free plan lacks and names the required tier", async () => {
    const db = fakeDb({ organizations: { data: { plan: "free" } } })
    const res = await gateFeature(db, "o1", "aiCapture")
    expect(res.allowed).toBe(false)
    if (!res.allowed) expect(res.requiredTier).toBe("pro")
  })

  it("requires business for a business-only feature", async () => {
    const db = fakeDb({ organizations: { data: { plan: "pro" } } })
    const res = await gateFeature(db, "o1", "peppolSend")
    expect(res.allowed).toBe(false)
    if (!res.allowed) expect(res.requiredTier).toBe("business")
  })
})

describe("issuedThisMonth", () => {
  it("returns the count", async () => {
    const db = fakeDb({ documents: { count: 3, error: null } })
    expect(await issuedThisMonth(db, "o1")).toBe(3)
  })

  it("returns null on a query error (so the caller can fail closed)", async () => {
    const db = fakeDb({ documents: { count: null, error: { message: "boom" } } })
    expect(await issuedThisMonth(db, "o1")).toBeNull()
  })
})

describe("gateDocumentIssue", () => {
  it("allows unlimited plans regardless of usage", async () => {
    const db = fakeDb({
      organizations: { data: { plan: "pro" } },
      documents: { count: 9999, error: null },
    })
    expect(await gateDocumentIssue(db, "o1")).toEqual({ allowed: true })
  })

  it("allows a free org under its monthly limit", async () => {
    const db = fakeDb({
      organizations: { data: { plan: "free" } },
      documents: { count: 2, error: null },
    })
    expect(await gateDocumentIssue(db, "o1")).toEqual({ allowed: true })
  })

  it("denies a free org at or over its monthly limit", async () => {
    const db = fakeDb({
      organizations: { data: { plan: "free" } },
      documents: { count: 5, error: null },
    })
    const res = await gateDocumentIssue(db, "o1")
    expect(res.allowed).toBe(false)
    if (!res.allowed) expect(res.requiredTier).toBe("pro")
  })

  it("FAILS CLOSED (denies) when the usage count cannot be verified", async () => {
    const db = fakeDb({
      organizations: { data: { plan: "free" } },
      documents: { count: null, error: { message: "db down" } },
    })
    const res = await gateDocumentIssue(db, "o1")
    expect(res.allowed).toBe(false)
  })
})
