import { describe, it, expect } from "vitest"
import {
  normalizeColor,
  isValidColor,
  contrastText,
  tagSchema,
  taggingSchema,
} from "./tag"

describe("normalizeColor", () => {
  it("adds the hash, expands the short form and lowercases", () => {
    expect(normalizeColor("3B82F6")).toBe("#3b82f6")
    expect(normalizeColor("#ABC")).toBe("#aabbcc")
    expect(normalizeColor("  #3b82f6  ")).toBe("#3b82f6")
  })

  it("treats empty input as no color", () => {
    expect(normalizeColor("")).toBeUndefined()
    expect(normalizeColor("   ")).toBeUndefined()
    expect(normalizeColor(null)).toBeUndefined()
    expect(normalizeColor(undefined)).toBeUndefined()
  })
})

describe("isValidColor", () => {
  it("accepts only the normalized #rrggbb form", () => {
    expect(isValidColor("#3b82f6")).toBe(true)
    expect(isValidColor("#3B82F6")).toBe(true)
    expect(isValidColor("#abc")).toBe(false)
    expect(isValidColor("red")).toBe(false)
    expect(isValidColor("")).toBe(false)
    expect(isValidColor(null)).toBe(false)
  })
})

describe("contrastText", () => {
  it("puts dark text on light backgrounds and white on dark ones", () => {
    expect(contrastText("#ffffff")).toBe("#111827")
    expect(contrastText("#f59e0b")).toBe("#111827")
    expect(contrastText("#22c55e")).toBe("#111827")
    expect(contrastText("#000000")).toBe("#ffffff")
    expect(contrastText("#1f2937")).toBe("#ffffff")
  })

  it("falls back to white for a missing or broken color", () => {
    expect(contrastText(null)).toBe("#ffffff")
    expect(contrastText("nope")).toBe("#ffffff")
  })
})

describe("tagSchema", () => {
  it("trims the name and normalizes the color", () => {
    const parsed = tagSchema.parse({ name: "  Marketing  ", color: "3B82F6" })
    expect(parsed).toEqual({ name: "Marketing", color: "#3b82f6" })
  })

  it("allows a tag without a color", () => {
    expect(tagSchema.parse({ name: "Web", color: "" }).color).toBeUndefined()
    expect(tagSchema.parse({ name: "Web" }).color).toBeUndefined()
  })

  it("rejects an empty name and a broken color", () => {
    expect(tagSchema.safeParse({ name: "   " }).success).toBe(false)
    expect(tagSchema.safeParse({ name: "x".repeat(41) }).success).toBe(false)
    expect(tagSchema.safeParse({ name: "Web", color: "modra" }).success).toBe(
      false,
    )
  })
})

describe("taggingSchema", () => {
  const uuid = "11111111-1111-4111-8111-111111111111"

  it("accepts the known taggable types", () => {
    for (const taggableType of ["document", "expense", "contact"] as const) {
      const parsed = taggingSchema.safeParse({
        tagId: uuid,
        taggableType,
        taggableId: uuid,
      })
      expect(parsed.success).toBe(true)
    }
  })

  it("rejects an unknown type or a non-uuid id", () => {
    expect(
      taggingSchema.safeParse({
        tagId: uuid,
        taggableType: "product",
        taggableId: uuid,
      }).success,
    ).toBe(false)
    expect(
      taggingSchema.safeParse({
        tagId: "1",
        taggableType: "document",
        taggableId: uuid,
      }).success,
    ).toBe(false)
  })
})
