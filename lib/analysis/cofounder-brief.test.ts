import { describe, it, expect } from "vitest"
import {
  buildPlanBrief,
  buildSectionFocusBlock,
  parseDraftResponse,
} from "@/lib/analysis/cofounder"
import { PLAN_SECTIONS, clearSectionUpdate, isPlaceholderValue } from "@/lib/analysis/plan-sections"
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

describe("buildPlanBrief (deterministic compact context)", () => {
  it("renders one line per plan section, in order", () => {
    const brief = buildPlanBrief(makeSpec())
    const lines = brief.split("\n")
    expect(lines).toHaveLength(PLAN_SECTIONS.length)
    PLAN_SECTIONS.forEach((def, i) => {
      expect(lines[i]).toContain(def.label)
    })
  })

  it("marks missing sections as (not defined) and keeps populated values", () => {
    const spec = makeSpec({ vision: "Become the default tool for indie founders." })
    const brief = buildPlanBrief(spec)
    expect(brief).toContain("Vision: Become the default tool for indie founders.")
    expect(brief).toContain("(not defined)")
  })

  it("treats generator placeholders as not defined", () => {
    const spec = makeSpec({ vision: "Not defined yet: who pays?" })
    expect(isPlaceholderValue("Not defined yet: who pays?")).toBe(true)
    const brief = buildPlanBrief(spec)
    expect(brief).toContain("- Vision: (not defined)")
  })

  it("previews long values with an ellipsis instead of shipping them whole", () => {
    const long = "x".repeat(400)
    const brief = buildPlanBrief(makeSpec({ vision: long }))
    const line = brief.split("\n").find((l) => l.startsWith("- Vision:"))!
    expect(line.length).toBeLessThan(160)
    expect(line.endsWith("…")).toBe(true)
  })

  it("reflects accepted changes immediately (never stale)", () => {
    const before = buildPlanBrief(makeSpec())
    expect(before).toContain("- Vision: (not defined)")
    const after = buildPlanBrief(
      makeSpec({ vision: "Become the plan-first workspace founders keep open." }),
    )
    expect(after).toContain("plan-first workspace")
  })

  it("never throws on a bare-minimum spec", () => {
    const brief = buildPlanBrief(makeSpec())
    expect(brief.split("\n")).toHaveLength(PLAN_SECTIONS.length)
  })
})

describe("buildSectionFocusBlock", () => {
  it("ships the full untruncated value for the focus section", () => {
    const long = "y".repeat(500)
    const spec = makeSpec({ vision: long })
    const block = buildSectionFocusBlock("vision", spec)
    expect(block).toContain(long)
  })

  it("labels undefined focus sections as not defined yet", () => {
    const block = buildSectionFocusBlock("vision", makeSpec())
    expect(block).toContain("FOCUS SECTION: Vision")
    expect(block).toContain("(not defined yet)")
  })

  it("lists related sections from the dependency map", () => {
    const block = buildSectionFocusBlock("targetUsers", makeSpec({ targetUsers: ["Independent restaurants"] }))
    expect(block).toContain("Sections commonly affected")
    expect(block).toContain("Value Proposition")
  })

  it("returns an empty string for an unknown section", () => {
    expect(buildSectionFocusBlock("not-a-section", makeSpec())).toBe("")
  })
})

describe("parseDraftResponse", () => {
  it("parses a clean JSON object", () => {
    expect(parseDraftResponse('{"value": "Drafted vision."}')).toEqual({ value: "Drafted vision." })
  })

  it("parses JSON wrapped in markdown fences", () => {
    expect(parseDraftResponse('```json\n{"value": "Fenced draft."}\n```')).toEqual({
      value: "Fenced draft.",
    })
  })

  it("extracts a JSON object embedded in surrounding prose", () => {
    expect(parseDraftResponse('Sure! {"value": "Embedded."} Hope it helps.')).toEqual({
      value: "Embedded.",
    })
  })

  it("tolerates a bare-text reply without JSON", () => {
    expect(parseDraftResponse("A perfectly serviceable draft paragraph.")).toEqual({
      value: "A perfectly serviceable draft paragraph.",
    })
  })

  it("returns null for empty, empty-value, or malformed responses", () => {
    expect(parseDraftResponse("")).toBeNull()
    expect(parseDraftResponse('{"value": ""}')).toBeNull()
    expect(parseDraftResponse('{"value": 42}')).toBeNull()
    expect(parseDraftResponse("{}")).toBeNull()
    expect(parseDraftResponse("<system-error>blocked</system-error>")).toBeNull()
  })
})

describe("clearSectionUpdate (undo path)", () => {
  it("resets a business section to empty and leaves others untouched", () => {
    const spec = makeSpec({ vision: "A vision.", growthPlan: "A plan." })
    const cleared = clearSectionUpdate(spec, "vision")
    expect(cleared.vision).toBe("")
    expect(cleared.growthPlan).toBe("A plan.")
    expect(spec.vision).toBe("A vision.") // original untouched
  })

  it("resets targetUsers to an empty list", () => {
    const spec = makeSpec({ targetUsers: ["Restaurants"] })
    const cleared = clearSectionUpdate(spec, "targetUsers")
    expect(cleared.targetUsers).toEqual([])
  })

  it("maps overview to description and never throws on unknown ids", () => {
    const spec = makeSpec({ description: "Desc." })
    expect(clearSectionUpdate(spec, "overview").description).toBe("")
    expect(clearSectionUpdate(spec, "features")).toBe(spec)
  })
})
