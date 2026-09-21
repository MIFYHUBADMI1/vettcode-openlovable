import { describe, expect, it } from "vitest"
import {
  composeVision,
  missionProgress,
  needsFollowUp,
  parseFirstMissionDraft,
  pathWithoutMissionParam,
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

  it("reports step progress so founders can see when onboarding ends", () => {
    expect(missionProgress("vision", false)).toMatchObject({ step: 1, total: 8 })
    expect(missionProgress("win", false)).toMatchObject({ step: 4, total: 8 })
    expect(missionProgress("plan", false)).toMatchObject({ step: 8, total: 8 })
    expect(missionProgress("context", true).step).toBe(2)
    expect(missionProgress("verify", false, true)).toMatchObject({ step: 2, total: 9 })
  })

  it("drops mission=1 from the dashboard url so skip can stick", () => {
    expect(pathWithoutMissionParam("/dashboard", "mission=1")).toBe("/dashboard")
    expect(pathWithoutMissionParam("/dashboard", "?mission=1&tab=activity")).toBe("/dashboard?tab=activity")
  })

  it("restores a JSON draft without dropping the current beat", () => {
    expect(parseFirstMissionDraft(JSON.stringify({ vision: "Clinic OS", beat: "win" }))).toMatchObject({
      vision: "Clinic OS",
      beat: "win",
    })
    expect(parseFirstMissionDraft("plain vision text")).toMatchObject({ vision: "plain vision text" })
  })
})
