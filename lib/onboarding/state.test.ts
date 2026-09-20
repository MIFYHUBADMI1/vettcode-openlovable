import { describe, expect, it } from "vitest"
import {
  composeVision,
  needsFollowUp,
  resolveFirstMissionSurface,
  signalForMode,
  sourceForMode,
} from "./state"

describe("onboarding state", () => {
  it("hides first mission when the founder already has a project", () => {
    expect(
      resolveFirstMissionSurface({
        isReady: true,
        projectCount: 1,
        hasPendingStart: false,
      }),
    ).toBe("hide")
  })

  it("hides when onboarding was activated even with zero local projects", () => {
    expect(
      resolveFirstMissionSurface({
        isReady: true,
        projectCount: 0,
        completedAt: Date.now(),
        hasPendingStart: false,
      }),
    ).toBe("hide")
  })

  it("redirects pending landing intent instead of asking again", () => {
    expect(
      resolveFirstMissionSurface({
        isReady: true,
        projectCount: 0,
        hasPendingStart: true,
      }),
    ).toBe("redirect-pending")
  })

  it("reopens the mission when the founder asks to start again", () => {
    expect(
      resolveFirstMissionSurface({
        isReady: true,
        projectCount: 0,
        dismissedAt: Date.now(),
        hasPendingStart: false,
        forceMission: true,
      }),
    ).toBe("mission")
  })

  it("does not treat skip as activation", () => {
    expect(
      resolveFirstMissionSurface({
        isReady: true,
        projectCount: 0,
        dismissedAt: Date.now(),
        hasPendingStart: false,
      }),
    ).toBe("empty-cta")
  })

  it("maps modes to compatible analytics fields", () => {
    expect(sourceForMode("idea", "landing")).toBe("landing_idea")
    expect(sourceForMode("website", "dashboard")).toBe("dashboard_mirror")
    expect(signalForMode("github")).toBe("url")
    expect(signalForMode("idea")).toBe("idea")
  })

  it("skips follow-up when the audience is already in the vision", () => {
    expect(needsFollowUp("idea", "A marketplace for restaurants to cut food waste")).toBe(false)
    expect(needsFollowUp("idea", "I want to build a marketplace connecting local farmers with restaurants")).toBe(false)
    expect(needsFollowUp("idea", "a marketplace")).toBe(true)
    expect(needsFollowUp("url", "https://example.com")).toBe(true)
  })

  it("keeps the original vision when composing follow-up", () => {
    expect(composeVision("Build a waste platform", "Independent restaurants")).toContain("Build a waste platform")
    expect(composeVision("Build a waste platform", "Independent restaurants")).toContain("Independent restaurants")
  })
})
