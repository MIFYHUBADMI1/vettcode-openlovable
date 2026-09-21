import { describe, expect, it } from "vitest"
import { parseOnboardingProfile } from "./profile"

describe("parseOnboardingProfile", () => {
  it("keeps known source, role, and building answers", () => {
    expect(
      parseOnboardingProfile({
        source: "reddit",
        role: "founder",
        signalType: "idea",
      }),
    ).toMatchObject({ source: "reddit", role: "founder", signalType: "idea" })
  })

  it("keeps historical acquisition sources that are not in the chip list", () => {
    expect(parseOnboardingProfile({ source: "dashboard_idea" }).source).toBe("dashboard_idea")
  })

  it("accepts goal and scale fields", () => {
    const parsed = parseOnboardingProfile({
      businessGoal: "Reach $50k ARR with a clinic booking product",
      revenueTarget: "50k_250k",
      targetUsers: "1k_10k",
      effortScale: 8,
      hoursPerDay: "2-3",
      intent: "ai_builder_only",
      selectedPlanId: "starter",
    })
    expect(parsed.effortScale).toBe(8)
    expect(parsed.intent).toBe("ai_builder_only")
    expect(parsed.selectedPlanId).toBe("starter")
    expect(parsed.hoursPerDay).toBe("2-3")
  })

  it("drops invalid enums and out-of-range effort", () => {
    const parsed = parseOnboardingProfile({
      role: "astronaut",
      effortScale: 12,
      hoursPerDay: "all-day",
      intent: "maybe",
    })
    expect(parsed.role).toBeUndefined()
    expect(parsed.effortScale).toBeUndefined()
    expect(parsed.hoursPerDay).toBeUndefined()
    expect(parsed.intent).toBeUndefined()
  })
})
