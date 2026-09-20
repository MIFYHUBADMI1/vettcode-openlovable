import { describe, expect, it } from "vitest"
import { buildOAuthHref, humanizeAuthError, sanitizeNext } from "./client-intent"

describe("sanitizeNext", () => {
  it("allows internal paths", () => {
    expect(sanitizeNext("/new/idea")).toBe("/new/idea")
    expect(sanitizeNext("/pricing")).toBe("/pricing")
  })

  it("rejects open redirects", () => {
    expect(sanitizeNext("https://evil.example")).toBe("/dashboard")
    expect(sanitizeNext("//evil.example")).toBe("/dashboard")
    expect(sanitizeNext("/\\evil")).toBe("/dashboard")
    expect(sanitizeNext(null)).toBe("/dashboard")
  })
})

describe("buildOAuthHref", () => {
  it("keeps next and referral on the existing OAuth routes", () => {
    expect(buildOAuthHref("google", { next: "/new/idea", ref: "abc" })).toBe(
      "/api/auth/google?next=%2Fnew%2Fidea&ref=abc",
    )
    expect(buildOAuthHref("github")).toBe("/api/auth/github")
  })
})

describe("humanizeAuthError", () => {
  it("hides provider implementation details", () => {
    expect(humanizeAuthError(new Error("AuthApiError: boom"))).toBe("Something went wrong. Please try again.")
    expect(humanizeAuthError(new Error("Incorrect email or password."))).toBe("Incorrect email or password.")
  })
})
