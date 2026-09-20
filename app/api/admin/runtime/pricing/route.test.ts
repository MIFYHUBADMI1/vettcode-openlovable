import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockRequireAdmin } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
}))

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: mockRequireAdmin,
}))

vi.mock("@/lib/runtime/admin/pricing-service", () => ({
  listAdminRuntimePricingRules: vi.fn().mockResolvedValue([]),
  createAdminRuntimePricingRule: vi.fn(),
  parseCreateRuleInput: vi.fn().mockReturnValue({ ok: false, error: "invalid" }),
}))

vi.mock("@/lib/runtime/router/capability-registry", () => ({
  listCapabilities: vi.fn().mockReturnValue([]),
}))

vi.mock("@/lib/runtime/router/provider-registry", () => ({
  listProviders: vi.fn().mockReturnValue([]),
}))

vi.mock("@/lib/runtime/router/adapters/register-all", () => ({
  registerAllRuntimeAdapters: vi.fn(),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET, POST } from "./route"
import { AppError } from "@/lib/errors"

describe("admin runtime pricing authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("unauthenticated GET is rejected", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new AppError("UNAUTHORIZED"))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("non-admin GET is rejected", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new AppError("UNAUTHORIZED", "Admin access required.", 403))
    const res = await GET()
    expect(res.status).toBe(403)
  })

  it("unauthenticated POST cannot change pricing", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new AppError("UNAUTHORIZED"))
    const res = await POST(new Request("https://atai.example/api/admin/runtime/pricing", { method: "POST", body: "{}" }))
    expect(res.status).toBe(401)
  })
})
