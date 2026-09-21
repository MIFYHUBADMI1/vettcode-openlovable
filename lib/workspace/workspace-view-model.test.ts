import { describe, expect, it } from "vitest"
import type { Project } from "@/lib/types/project"
import {
  buildWorkspaceView,
  journeyPhase,
  workspaceBrief,
  workspaceIsLive,
  workspaceNextStep,
} from "./workspace-view-model"

function project(partial: Partial<Project>): Project {
  return {
    id: "p1",
    userId: "u1",
    mode: "scratch",
    name: "MarketFlow",
    state: "created",
    events: [],
    conversation: [],
    deployment: { id: "d", status: "idle", updatedAt: 0 },
    deploymentHistory: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe("workspace view model", () => {
  it("maps persisted states onto founder journey phases", () => {
    expect(journeyPhase("analyzing")).toBe("understand")
    expect(journeyPhase("plan_ready")).toBe("plan")
    expect(journeyPhase("building")).toBe("build")
    expect(journeyPhase("ready")).toBe("validate")
    expect(journeyPhase("deployed")).toBe("launch")
    expect(journeyPhase("build_failed")).toBe("build")
  })

  it("marks analysis, build, and deploy as live work", () => {
    expect(workspaceIsLive("analyzing")).toBe(true)
    expect(workspaceIsLive("building")).toBe(true)
    expect(workspaceIsLive("deploying")).toBe(true)
    expect(workspaceIsLive("ready")).toBe(false)
  })

  it("uses mode-aware research copy", () => {
    expect(workspaceBrief("analyzing", "scratch").headline).toMatch(/idea/i)
    expect(workspaceBrief("analyzing", "github").headline).toMatch(/codebase/i)
    expect(workspaceBrief("analyzing", "website").headline).toMatch(/reference site/i)
  })

  it("asks the founder to review the plan without implying a redirect", () => {
    const next = workspaceNextStep("plan_ready", "p1", false)
    expect(next.needsYou).toBe(true)
    expect(next.href).toBe("/project/p1/collaborate")
    expect(next.mutation).toBeNull()
  })

  it("offers one start-build mutation before the first build", () => {
    const next = workspaceNextStep("specification_ready", "p1", false)
    expect(next.mutation).toBe("build")
    expect(next.actionLabel).toBe("Start building")
  })

  it("does not treat optional GitHub as a blocker", () => {
    const view = buildWorkspaceView(project({ state: "ready", totalumProjectId: "t1", developmentUrl: "https://app.example" }))
    const github = view.capabilities.find((c) => c.id === "github")
    expect(github?.status).toBe("optional")
    expect(github?.detail).toBe("Not connected")
    expect(view.next.kind).toBe("launch")
  })
})
