import { describe, expect, it, vi } from "vitest"

// The repo runs Vitest outside the Next server bundle — mock the server-only
// guard the same way other suites do.
vi.mock("server-only", () => ({}))

import { listTools, getTool, immediateTools, confirmationTools, riskOf } from "./tool-registry"

/**
 * Closed tool-registry tests (spec sections 10, 51, 69). The registry is the
 * explicit allow-list of everything the Co-founder can do; these tests pin
 * its invariants and make sure dangerous capabilities never slip in.
 */

const FORBIDDEN_TOOL_NAMES = [
  "manage_runtime_keys",
  "create_api_key",
  "revoke_api_key",
  "invoke_runtime",
  "manage_secrets",
  "checkout",
  "top_up_credits",
  "change_subscription",
  "grant_credits",
  "reconcile_ledger",
  "admin_stats",
  "admin_users",
  "change_password",
  "manage_sessions",
  "verify_email",
  "delete_all_projects",
]

describe("tool registry — allow-list invariants", () => {
  it("exposes a closed, non-empty registry", () => {
    expect(listTools().length).toBeGreaterThan(0)
    // Registry entries are unique by name.
    const names = listTools().map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("does not expose any forbidden v1 capability (spec section 51)", () => {
    const names = new Set(listTools().map((t) => t.name))
    for (const forbidden of FORBIDDEN_TOOL_NAMES) {
      expect(names.has(forbidden)).toBe(false)
    }
    // Unregistered lookups can never execute.
    for (const forbidden of FORBIDDEN_TOOL_NAMES) {
      expect(getTool(forbidden)).toBeUndefined()
    }
  })

  it("only knows the exact v1 tool set", () => {
    const expected = new Set([
      "get_workspace_overview",
      "list_projects",
      "get_project",
      "get_project_activity",
      "get_plan",
      "analyze_plan",
      "get_build_status",
      "get_build_logs",
      "get_build_conversation",
      "navigate",
      "get_account_summary",
      "get_credit_costs",
      "stop_build",
      "propose_plan_update",
      "apply_plan_update",
      "autocomplete_plan",
      "create_project",
      "request_build",
      "request_followup_edit",
      "request_deploy",
      "delete_project",
    ])
    const actual = new Set(listTools().map((t) => t.name))
    expect(actual).toEqual(expected)
  })
})

describe("tool registry — risk and confirmation invariants", () => {
  it("requires confirmation exactly for CONFIRM and HARD_CONFIRM tools", () => {
    for (const tool of listTools()) {
      const shouldConfirm = tool.risk === "CONFIRM" || tool.risk === "HARD_CONFIRM"
      expect(tool.requiresConfirmation, `${tool.name} risk=${tool.risk}`).toBe(shouldConfirm)
    }
  })

  it("gives every confirmation tool a prepare and executeApproved phase", () => {
    for (const tool of confirmationTools()) {
      expect(typeof tool.prepare, `${tool.name} prepare`).toBe("function")
      expect(typeof tool.executeApproved, `${tool.name} executeApproved`).toBe("function")
      expect(tool.execute, `${tool.name} must not have an immediate execute`).toBeUndefined()
    }
  })

  it("gives every immediate tool an execute phase and no approved execution path", () => {
    for (const tool of immediateTools()) {
      expect(typeof tool.execute, `${tool.name} execute`).toBe("function")
      expect(tool.prepare, `${tool.name} must not have prepare`).toBeUndefined()
      expect(tool.executeApproved, `${tool.name} must not have executeApproved`).toBeUndefined()
    }
  })

  it("keeps destructive/destructive-adjacent tools on HARD_CONFIRM", () => {
    expect(riskOf("delete_project")).toBe("HARD_CONFIRM")
    expect(riskOf("request_build")).toBe("HARD_CONFIRM")
    expect(riskOf("request_followup_edit")).toBe("HARD_CONFIRM")
    expect(riskOf("request_deploy")).toBe("HARD_CONFIRM")
  })

  it("keeps mutation-adjacent but reversible tools at CONFIRM or below", () => {
    expect(riskOf("create_project")).toBe("CONFIRM")
    expect(riskOf("propose_plan_update")).toBe("CONFIRM")
    expect(riskOf("apply_plan_update")).toBe("CONFIRM")
    expect(riskOf("autocomplete_plan")).toBe("CONFIRM")
    expect(riskOf("stop_build")).toBe("LOW_RISK_WRITE")
  })

  it("keeps all read tools at READ with no confirmation", () => {
    for (const name of [
      "get_workspace_overview",
      "list_projects",
      "get_project",
      "get_project_activity",
      "get_plan",
      "analyze_plan",
      "get_build_status",
      "get_build_logs",
      "get_build_conversation",
      "navigate",
      "get_account_summary",
      "get_credit_costs",
    ]) {
      expect(riskOf(name)).toBe("READ")
      expect(getTool(name)?.requiresConfirmation).toBe(false)
    }
  })
})

describe("tool registry — schema hygiene", () => {
  it("gives every tool a zod object schema with descriptions for the model", () => {
    for (const tool of listTools()) {
      expect(tool.description.length, `${tool.name} description`).toBeGreaterThan(20)
      expect(tool.inputSchema, `${tool.name} inputSchema`).toBeTruthy()
      // Stripped schemas — no pass-through of unknown keys.
      expect(() => tool.inputSchema.parse({ rogue: "key" }, {})).not.toThrow
    }
  })
})
