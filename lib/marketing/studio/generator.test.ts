import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { deriveBrandVoice, buildTemplateMessages, isStudioTemplate, STUDIO_TEMPLATES, studioTemplateLabel } from "./generator"
import type { ApplicationSpecification } from "@/lib/types/specification"

/**
 * Marketing Studio generator (Phase 4 — W3) — PURE prompt layer. No AI SDK call
 * is exercised here (that lives behind `generateCopy`'s single network boundary).
 * These tests pin the deterministic, anti-fabrication contract the drafts rest on.
 */

function spec(partial: Partial<ApplicationSpecification>): ApplicationSpecification {
  return partial as unknown as ApplicationSpecification
}

describe("deriveBrandVoice", () => {
  it("assembles voice from the plan fields that exist and reports their sources", () => {
    const { voice, sources } = deriveBrandVoice(
      spec({ brandIdentity: "Bold, friendly, teal accents", valueProposition: "Ship internal tools fast", targetUsers: ["ops leads", "PMs"] }),
    )
    expect(voice).toContain("Bold, friendly")
    expect(voice).toContain("Ship internal tools fast")
    expect(voice).toContain("ops leads")
    expect(sources).toContain("Brand & visual identity")
    expect(sources).toContain("Target audience")
  })

  it("returns empty voice and no sources when the spec is missing", () => {
    const { voice, sources } = deriveBrandVoice(undefined)
    expect(voice).toBe("")
    expect(sources).toEqual([])
  })

  it("ignores blank fields rather than emitting empty labels", () => {
    const { voice, sources } = deriveBrandVoice(spec({ brandIdentity: "   ", valueProposition: "" }))
    expect(voice).toBe("")
    expect(sources).toEqual([])
  })
})

describe("buildTemplateMessages", () => {
  it("is deterministic — identical inputs produce identical prompts", () => {
    const input = { template: "landing_hero" as const, projectName: "Acme", brandVoice: "Bold" }
    expect(buildTemplateMessages(input)).toEqual(buildTemplateMessages(input))
  })

  it("instructs the model NOT to fabricate metrics, rankings, prices, or results", () => {
    const { system } = buildTemplateMessages({ template: "feature_blurb", projectName: "Acme", brandVoice: "Friendly" })
    expect(system.toLowerCase()).toMatch(/do not invent/)
    expect(system.toLowerCase()).toMatch(/numbers|statistics|prices|rankings|results/)
  })

  it("weaves the brand voice and project name into the prompt", () => {
    const { prompt } = buildTemplateMessages({ template: "email_welcome", projectName: "Acme", brandVoice: "Warm, plain language" })
    expect(prompt).toContain("Acme")
    expect(prompt).toContain("Warm, plain language")
  })

  it("includes the founder brief when provided", () => {
    const { prompt } = buildTemplateMessages({ template: "ad_headline", projectName: "Acme", brandVoice: "Bold", brief: "highlight the free tier" })
    expect(prompt).toContain("highlight the free tier")
  })

  it("falls back to a neutral note when there is no brand voice on file", () => {
    const { prompt } = buildTemplateMessages({ template: "landing_hero", projectName: "Acme", brandVoice: "" })
    expect(prompt).toContain("no brand voice on file")
  })
})

describe("template allow-list", () => {
  it("only knows the fixed product templates", () => {
    expect(STUDIO_TEMPLATES).toEqual(["landing_hero", "feature_blurb", "email_welcome", "ad_headline"])
    expect(isStudioTemplate("landing_hero")).toBe(true)
    expect(isStudioTemplate("publish_now" as never)).toBe(false)
    expect(studioTemplateLabel("ad_headline")).toBe("Ad headline set")
  })
})
