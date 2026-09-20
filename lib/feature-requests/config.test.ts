import { describe, expect, it } from "vitest"
import { isFeatureRequestCategory, isFeatureRequestStatus, similarScore } from "./config"

describe("feature request similarity", () => {
  it("scores overlapping titles highly", () => {
    expect(similarScore("Add WhatsApp integration", "WhatsApp integration for generated apps")).toBeGreaterThan(0.35)
  })

  it("scores unrelated titles low", () => {
    expect(similarScore("Custom billing invoices", "Mobile dark mode")).toBeLessThan(0.35)
  })

  it("ignores short tokens", () => {
    expect(similarScore("AI UX", "AI UX tools")).toBeGreaterThanOrEqual(0)
  })
})

describe("feature request enums", () => {
  it("accepts known category and status", () => {
    expect(isFeatureRequestCategory("runtime")).toBe(true)
    expect(isFeatureRequestCategory("not-real")).toBe(false)
    expect(isFeatureRequestStatus("shipped")).toBe(true)
    expect(isFeatureRequestStatus("pending")).toBe(false)
  })
})
