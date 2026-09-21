import { describe, expect, it } from "vitest"
import type { ProjectSummary } from "@/lib/types/project"
import {
  buildNotificationInbox,
  filterMeaningfulActivity,
  getDashboardAttentionItems,
  interpretProjectState,
  selectActiveProject,
} from "./view-model"

function project(partial: Partial<ProjectSummary> & Pick<ProjectSummary, "id" | "state">): ProjectSummary {
  return {
    name: partial.name ?? partial.id,
    mode: "scratch",
    updatedAt: partial.updatedAt ?? 1,
    ...partial,
  }
}

describe("interpretProjectState", () => {
  it("maps plan_ready to review CTA without exposing raw state", () => {
    const status = interpretProjectState("plan_ready", "p1")
    expect(status.founderLabel).toBe("Plan ready")
    expect(status.primaryAction.href).toContain("/collaborate")
    expect(status.headline.toLowerCase()).not.toContain("plan_ready")
  })

  it("surfaces build failure as an error with a fix path", () => {
    const status = interpretProjectState("build_failed", "p1")
    expect(status.severity).toBe("error")
    expect(status.primaryAction.href).toContain("/edit")
  })
})

describe("selectActiveProject", () => {
  it("prefers failures over newest", () => {
    const active = selectActiveProject([
      project({ id: "new", state: "created", updatedAt: 99 }),
      project({ id: "fail", state: "build_failed", updatedAt: 1 }),
    ])
    expect(active?.id).toBe("fail")
  })

  it("prefers plan review over idle newest", () => {
    const active = selectActiveProject([
      project({ id: "idle", state: "created", updatedAt: 50 }),
      project({ id: "plan", state: "plan_ready", updatedAt: 10 }),
    ])
    expect(active?.id).toBe("plan")
  })
})

describe("getDashboardAttentionItems", () => {
  it("includes email verification and failed builds", () => {
    const items = getDashboardAttentionItems({
      emailVerified: false,
      projects: [project({ id: "a", name: "Marketly", state: "build_failed" })],
    })
    expect(items.some((i) => i.id === "email")).toBe(true)
    expect(items.some((i) => i.id === "build-fail-a")).toBe(true)
  })
})

describe("buildNotificationInbox", () => {
  it("surfaces failed builds and live work as actionable inbox items", () => {
    const items = buildNotificationInbox({
      emailVerified: true,
      now: 20,
      projects: [
        project({ id: "fail", name: "Marketly", state: "build_failed", updatedAt: 10 }),
        project({ id: "build", name: "Ledger", state: "building", updatedAt: 12 }),
      ],
    })
    expect(items.some((i) => i.id === "build-fail-fail" && i.kind === "action")).toBe(true)
    expect(items.some((i) => i.id.startsWith("progress-build") && i.href.includes("/project/build"))).toBe(true)
  })

  it("includes shipped feature requests without inventing extra scores", () => {
    const items = buildNotificationInbox({
      emailVerified: true,
      now: 50,
      projects: [],
      featureRequests: [{ id: "fr1", title: "Custom models", status: "shipped", updatedAt: 40 }],
    })
    expect(items[0]?.href).toBe("/feature-requests/fr1")
    expect(items[0]?.title.toLowerCase()).toContain("shipped")
  })
})

describe("filterMeaningfulActivity", () => {
  it("drops heartbeat noise", () => {
    const items = filterMeaningfulActivity(
      [
        { id: "1", at: 2, level: "info", stage: "heartbeat", message: "ok" },
        { id: "2", at: 3, level: "info", stage: "build", message: "Build completed" },
      ],
      project({ id: "a", name: "Marketly", state: "ready" }),
    )
    expect(items).toHaveLength(1)
    expect(items[0]!.title).toBe("Build completed")
  })
})
