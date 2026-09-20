/**
 * Atai Runtime — Phase 4 authorization tests (scope primitives).
 */

import { describe, it, expect, vi } from "vitest"

// Repo runs Vitest outside the Next server bundle — mock the marker package.
vi.mock("server-only", () => ({}))

import { scopeCovers, hasRuntimeScope, requireRuntimeScope } from "./authorize"
import type { CapabilityScope } from "@/runtime/contracts/capabilities"

describe("scopeCovers / hasRuntimeScope", () => {
  it("empty scopes = all capabilities granted (Phase 2 convention)", () => {
    expect(scopeCovers([], "ai.text")).toBe(true)
    expect(scopeCovers([], "payments")).toBe(true)
  })

  it("exact scope match is covered", () => {
    expect(scopeCovers(["ai.text"], "ai.text")).toBe(true)
  })

  it("granted parent capability covers its dotted sub-operations", () => {
    // Sub-operation strings are not yet in the CapabilityId union (Phase 2
    // keeps the vocabulary strict); the runtime check is prefix-based and
    // forward-compatible with the future dotted namespace, so cast here.
    const sub = (s: string) => s as CapabilityScope
    expect(scopeCovers(["ai.image"], sub("ai.image.generate"))).toBe(true)
    expect(scopeCovers(["search.web"], sub("search.web.news"))).toBe(true)
  })

  it("unrelated capabilities are denied", () => {
    expect(scopeCovers(["ai.text"], "payments")).toBe(false)
    expect(scopeCovers(["ai.image"], "ai.text")).toBe(false)
  })

  it("hasRuntimeScope reads from an auth-context-shaped object", () => {
    expect(hasRuntimeScope({ scopes: ["ai.text"] }, "ai.text")).toBe(true)
    expect(hasRuntimeScope({ scopes: ["ai.text"] }, "search.web")).toBe(false)
  })
})

describe("requireRuntimeScope", () => {
  it("returns silently when covered", () => {
    expect(() => requireRuntimeScope({ scopes: [] }, "ai.text")).not.toThrow()
    expect(() => requireRuntimeScope({ scopes: ["ai.text"] }, "ai.text")).not.toThrow()
  })

  it("throws runtime_capability_not_allowed (403) when not covered", () => {
    try {
      requireRuntimeScope({ scopes: ["ai.text"] }, "search.web")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect((e as { code?: string }).code).toBe("runtime_capability_not_allowed")
      expect((e as { status?: number }).status).toBe(403)
    }
  })
})
