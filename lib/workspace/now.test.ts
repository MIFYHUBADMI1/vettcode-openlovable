import { describe, expect, it } from "vitest"
import { workspaceIsLive, workspaceTeam } from "./now"

describe("workspace now copy", () => {
  it("marks analysis, build, and deploy as live", () => {
    expect(workspaceIsLive("analyzing")).toBe(true)
    expect(workspaceIsLive("building")).toBe(true)
    expect(workspaceIsLive("deploying")).toBe(true)
    expect(workspaceIsLive("ready")).toBe(false)
  })

  it("names the team on the floor", () => {
    expect(workspaceTeam("building").kicker).toContain("Engineering")
    expect(workspaceTeam("plan_ready").kicker).toContain("Co-founder")
    expect(workspaceTeam("ready").kicker).toContain("Product")
  })
})
