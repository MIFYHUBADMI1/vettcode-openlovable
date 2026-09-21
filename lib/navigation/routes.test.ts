import { describe, expect, it } from "vitest"
import {
  resolveNavigationTarget,
  isKnownTarget,
  isProjectTarget,
  WORKSPACE_TARGETS,
  PROJECT_TARGETS,
} from "./routes"

/**
 * Navigation registry tests (spec sections 25–26, 69). The AI never authors
 * an href — it produces a structured target resolved here. Arbitrary or
 * model-invented paths must never resolve.
 */

describe("route registry — valid targets", () => {
  it("resolves every workspace target", () => {
    expect(resolveNavigationTarget({ target: "dashboard" })).toBe("/dashboard")
    expect(resolveNavigationTarget({ target: "projects" })).toBe("/projects")
    expect(resolveNavigationTarget({ target: "newProject" })).toBe("/new")
    expect(resolveNavigationTarget({ target: "explore" })).toBe("/explore")
    expect(resolveNavigationTarget({ target: "featureRequests" })).toBe("/feature-requests")
    expect(resolveNavigationTarget({ target: "billing" })).toBe("/settings/billing")
    expect(resolveNavigationTarget({ target: "settings" })).toBe("/settings/profile")
  })

  it("resolves every project target with a projectId", () => {
    expect(resolveNavigationTarget({ target: "project", projectId: "abc" })).toBe("/project/abc")
    expect(resolveNavigationTarget({ target: "plan", projectId: "abc" })).toBe("/project/abc/plan")
    expect(resolveNavigationTarget({ target: "collaborate", projectId: "abc" })).toBe("/project/abc/collaborate")
    expect(resolveNavigationTarget({ target: "database", projectId: "abc" })).toBe("/project/abc/database")
    expect(resolveNavigationTarget({ target: "edit", projectId: "abc" })).toBe("/project/abc/edit")
    expect(resolveNavigationTarget({ target: "source", projectId: "abc" })).toBe("/project/abc/source")
    expect(resolveNavigationTarget({ target: "tree", projectId: "abc" })).toBe("/project/abc/tree")
    expect(resolveNavigationTarget({ target: "repoCode", projectId: "abc" })).toBe("/project/abc/repo-code")
    expect(resolveNavigationTarget({ target: "readme", projectId: "abc" })).toBe("/project/abc/readme")
    expect(resolveNavigationTarget({ target: "runtime", projectId: "abc" })).toBe("/project/abc/runtime")
  })

  it("encodes project ids into the path", () => {
    const href = resolveNavigationTarget({ target: "project", projectId: "a b/c" })
    expect(href).toBe("/project/a%20b%2Fc")
    expect(href).not.toContain(" ")
  })
})

describe("route registry — rejections", () => {
  it("rejects unknown targets", () => {
    expect(() => resolveNavigationTarget({ target: "admin" } as never)).toThrow()
    expect(() => resolveNavigationTarget({ target: "javascript:alert(1)" } as never)).toThrow()
    expect(() => resolveNavigationTarget({ target: "https://evil.example" } as never)).toThrow()
    expect(() => resolveNavigationTarget({ target: "/arbitrary/path" } as never)).toThrow()
    expect(isKnownTarget("javascript:alert(1)")).toBe(false)
    expect(isKnownTarget("/dashboard")).toBe(false)
  })

  it("rejects project targets without a projectId", () => {
    expect(() => resolveNavigationTarget({ target: "project" })).toThrow()
    expect(() => resolveNavigationTarget({ target: "plan", projectId: "" })).toThrow()
    expect(() => resolveNavigationTarget({ target: "runtime" })).toThrow()
  })

  it("rejects a projectId on workspace targets by ignoring it (no project scope)", () => {
    // Workspace targets never leak into project routes.
    const href = resolveNavigationTarget({ target: "dashboard" })
    expect(href).toBe("/dashboard")
  })
})

describe("route registry — target classification", () => {
  it("classifies targets consistently with the declared lists", () => {
    for (const target of PROJECT_TARGETS) {
      expect(isProjectTarget(target)).toBe(true)
      expect(isKnownTarget(target)).toBe(true)
    }
    for (const target of WORKSPACE_TARGETS) {
      expect(isProjectTarget(target)).toBe(false)
      expect(isKnownTarget(target)).toBe(true)
    }
  })
})
