import { afterEach, describe, expect, it, vi } from "vitest"
import { CAPABILITY_OPERATIONS } from "@/runtime/contracts/router"
import { capabilityAvailability } from "./availability"

// Same stubs the runtime router tests use — server-only and logging are
// environment concerns, not what these tests exercise.
vi.mock("server-only", () => ({}))
vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe("capabilityAvailability — capability discovery status metadata", () => {
  afterEach(() => {
    delete process.env.MAPBOX_ACCESS_TOKEN
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.CLOUDFLARE_API_TOKEN
  })

  it("covers exactly the capabilities the contract registry knows about", () => {
    const availability = capabilityAvailability()
    expect(Object.keys(availability).sort()).toEqual(Object.keys(CAPABILITY_OPERATIONS).sort())
  })

  it("resolves wired capabilities to their production provider", () => {
    const availability = capabilityAvailability()
    expect(availability["maps"]?.provider).toBe("mapbox")
    expect(availability["calendar"]?.provider).toBe("calcom")
    expect(availability["db"]?.provider).toBe("totalum")
    expect(availability["payments"]?.provider).toBe("dodo")
    expect(availability["sms"]?.provider).toBe("twilio")
    expect(availability["email"]?.provider).toBe("resend")
    expect(availability["notifications"]?.provider).toBe("firebase")
    expect(availability["vectors"]?.provider).toBe("cloudflare")
    expect(availability["ai.speak"]?.provider).toBe("elevenlabs")
    expect(availability["search.web"]?.provider).toBe("firecrawl")
  })

  it("marks unwired capabilities with no provider and unavailable operations", () => {
    const availability = capabilityAvailability()
    // The test-only "echo" capability never ships a production adapter (§39).
    expect(availability["test"]?.provider).toBeNull()
    for (const op of availability["test"]?.operations ?? []) {
      expect(op.available).toBe(false)
    }
  })

  it("reports configuration gaps as env var NAMES only — never values", () => {
    delete process.env.MAPBOX_ACCESS_TOKEN
    let availability = capabilityAvailability()
    expect(availability["maps"]?.configured).toBe(false)
    expect(availability["maps"]?.missingEnvVars).toEqual(["MAPBOX_ACCESS_TOKEN"])

    process.env.MAPBOX_ACCESS_TOKEN = "test-only-token-name"
    availability = capabilityAvailability()
    expect(availability["maps"]?.configured).toBe(true)
    expect(availability["maps"]?.missingEnvVars).toEqual([])
  })

  it("per-operation availability follows the registry wiring", () => {
    const availability = capabilityAvailability()
    // ai.text: chat + completion (OpenRouter), embed alias (Cloudflare).
    const ops = Object.fromEntries((availability["ai.text"]?.operations ?? []).map((o) => [o.name, o.available]))
    expect(ops["chat"]).toBe(true)
    expect(ops["completion"]).toBe(true)
    expect(ops["embed"]).toBe(true)
    // Dedicated embeddings capability resolves to the same provider.
    expect(availability["ai.embed"]?.provider).toBe("cloudflare")
    expect(availability["ai.embed"]?.operations.every((o) => o.available)).toBe(true)
    expect(availability["ai.embed"]?.configured).toBe(
      Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    )
    // Payments: all four commerce operations are wired on the Dodo adapter.
    const paymentsOps = Object.fromEntries(
      (availability["payments"]?.operations ?? []).map((o) => [o.name, o.available]),
    )
    for (const op of ["createCheckout", "createSubscription", "listPayments", "listPayouts"]) {
      expect(paymentsOps[op]).toBe(true)
    }
  })
})
