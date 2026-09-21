import { describe, expect, it } from "vitest"
import { checkoutReturnPath } from "./checkout-return"

describe("checkout return path", () => {
  it("keeps onboarding and billing returns", () => {
    expect(checkoutReturnPath("/start")).toBe("/start")
    expect(checkoutReturnPath("/settings/billing")).toBe("/settings/billing")
    expect(checkoutReturnPath("/dashboard")).toBe("/dashboard")
  })

  it("rejects arbitrary or unsafe urls", () => {
    expect(checkoutReturnPath("https://evil.example/phish")).toBe("/settings/billing")
    expect(checkoutReturnPath("//evil.example")).toBe("/settings/billing")
    expect(checkoutReturnPath("/admin")).toBe("/settings/billing")
  })
})
