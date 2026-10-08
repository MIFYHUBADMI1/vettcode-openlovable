import { describe, expect, it } from "vitest"
import { isFounderFacingEvent } from "./team-roles"

describe("isFounderFacingEvent", () => {
  it("hides fetch telemetry and api paths", () => {
    expect(isFounderFacingEvent({ message: "Fetch GET /status" })).toBe(false)
    expect(isFounderFacingEvent({ message: "called /api/v1/projects" })).toBe(false)
  })

  it("hides credentials and private keys", () => {
    expect(isFounderFacingEvent({ message: "token sk-abc123456789" })).toBe(false)
    expect(isFounderFacingEvent({ message: "Authorization: Bearer abc.def" })).toBe(false)
    expect(isFounderFacingEvent({ message: "-----BEGIN PRIVATE KEY-----" })).toBe(false)
  })

  it("keeps ordinary founder outcomes", () => {
    expect(isFounderFacingEvent({ message: "The initial application build completed." })).toBe(true)
  })
})
