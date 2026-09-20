import { describe, it, expect } from "vitest"
import {
  PLAN_SECTIONS,
  getPlanSection,
  sectionStatus,
  computePlanHealth,
  validatePlanSectionValue,
  applySectionUpdate,
  isPlaceholderValue,
} from "@/lib/analysis/plan-sections"
import { parseChatProposal, parseAnalysisResponse, buildProposal } from "@/lib/analysis/cofounder"
import { ApplicationSpecificationSchema, type ApplicationSpecification } from "@/lib/types/specification"

function makeSpec(overrides: Partial<ApplicationSpecification> = {}): ApplicationSpecification {
  return ApplicationSpecificationSchema.parse({
    applicationType: "saas",
    title: "Test App",
    description: "A test application for founders.",
    purpose: "Test the collaborate workspace.",
    ...overrides,
  })
}

describe("plan sections", () => {
  it("maps every section to a real spec field and never throws", () => {
    const spec = makeSpec()
    for (const def of PLAN_SECTIONS) {
      expect(typeof def.read(spec)).toBe("string")
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.group.length).toBeGreaterThan(0)
    }
  })

  it("marks empty fields as missing and populated fields as complete", () => {
    const spec = makeSpec({ vision: "Become the default tool for indie founders." })
    expect(sectionStatus(getPlanSection("vision")!, spec)).toBe("complete")
    expect(sectionStatus(getPlanSection("businessModel")!, spec)).toBe("missing")
  })

  it("treats generator placeholders as missing", () => {
    expect(isPlaceholderValue("Not defined yet: who pays?")).toBe(true)
    expect(isPlaceholderValue("A real vision statement")).toBe(false)
  })

  it("computes a deterministic, explainable health percentage", () => {
    const spec = makeSpec()
    const health = computePlanHealth(spec)
    const complete = health.sections.filter((s) => s.status === "complete").length
    expect(health.percent).toBe(Math.round((complete / PLAN_SECTIONS.length) * 100))
    expect(health.missing.length).toBe(PLAN_SECTIONS.length - complete)
  })

  it("validates proposed section values", () => {
    expect(validatePlanSectionValue("vision", "A clear vision").ok).toBe(true)
    expect(validatePlanSectionValue("unknown_section", "x").ok).toBe(false)
    expect(validatePlanSectionValue("vision", "").ok).toBe(false)
    expect(validatePlanSectionValue("vision", 42).ok).toBe(false)
    expect(validatePlanSectionValue("vision", "x".repeat(9000)).ok).toBe(false)
  })

  it("applies section updates immutably", () => {
    const spec = makeSpec({ vision: "Old vision" })
    const next = applySectionUpdate(spec, "vision", "New vision")
    expect(next.vision).toBe("New vision")
    expect(spec.vision).toBe("Old vision")

    const users = applySectionUpdate(spec, "targetUsers", "Restaurants, Cafes")
    expect(users.targetUsers).toEqual(["Restaurants", "Cafes"])
  })
})

describe("chat proposal parsing", () => {
  it("extracts a valid <plan-update> block and strips it from the reply", () => {
    const reply = 'Here is my take.\n\n<plan-update>{"section":"vision","proposedValue":"New vision text","reason":"Sharper focus"}</plan-update>'
    const { cleanReply, proposal } = parseChatProposal(reply)
    expect(cleanReply).toBe("Here is my take.")
    expect(proposal).toEqual({ section: "vision", proposedValue: "New vision text", reason: "Sharper focus" })
  })

  it("returns null for replies without a proposal block", () => {
    const { cleanReply, proposal } = parseChatProposal("Just a normal answer.")
    expect(proposal).toBeNull()
    expect(cleanReply).toBe("Just a normal answer.")
  })

  it("rejects proposals for unknown sections and malformed JSON", () => {
    const bad = '<plan-update>{"section":"not_a_section","proposedValue":"x"}</plan-update>'
    expect(parseChatProposal(bad).proposal).toBeNull()
    const broken = "<plan-update>{not json}</plan-update>"
    expect(parseChatProposal(broken).proposal).toBeNull()
  })

  it("stamps the real current value when building a proposal", () => {
    const spec = makeSpec({ vision: "Existing vision" })
    const p = buildProposal(spec, { section: "vision", proposedValue: "Better", reason: "Why" }, "chat")
    expect(p.currentValue).toBe("Existing vision")
    expect(p.proposedValue).toBe("Better")
    expect(p.source).toBe("chat")
    expect(p.id.length).toBeGreaterThan(0)
  })
})

describe("analysis response parsing", () => {
  const validAnalysis = JSON.stringify({
    summary: "The plan has gaps.",
    findings: [
      { section: "revenueModel", severity: "gap", title: "No revenue model", currentState: "(not defined yet)", why: "Money matters", recommendation: "Define pricing" },
      { section: "made_up_section", severity: "gap", title: "Should be dropped" },
      { section: "vision", severity: "nope", title: "Bad severity, dropped" },
    ],
    proposals: [
      { section: "revenueModel", proposedValue: "Subscription at $10/mo", reason: "Simple entry" },
      { section: "bogus", proposedValue: "Dropped" },
    ],
    nextBestAction: { section: "revenueModel", title: "Define revenue", why: "First" },
  })

  it("keeps valid findings/proposals and drops ones referencing unknown sections", () => {
    const spec = makeSpec()
    const analysis = parseAnalysisResponse(validAnalysis, spec)
    expect(analysis).not.toBeNull()
    expect(analysis!.findings).toHaveLength(1)
    expect(analysis!.findings[0].section).toBe("revenueModel")
    expect(analysis!.proposals).toHaveLength(1)
    expect(analysis!.nextBestAction?.title).toBe("Define revenue")
    expect(analysis!.healthPercent).toBe(computePlanHealth(spec).percent)
  })

  it("tolerates markdown fences around the JSON", () => {
    const wrapped = "```json\n" + validAnalysis + "\n```"
    expect(parseAnalysisResponse(wrapped, makeSpec())).not.toBeNull()
  })

  it("returns null for unparseable output", () => {
    expect(parseAnalysisResponse("The model rambled instead of answering.", makeSpec())).toBeNull()
  })
})
