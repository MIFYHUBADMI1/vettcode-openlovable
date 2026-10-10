import { describe, expect, it } from "vitest"

import { buildTrackedUrl, channelToUtmMedium, slugify } from "./utm"

/**
 * UTM link conventions (Phase 6 — W5). The helper is PURE and offline: it only
 * validates an absolute http(s) base and appends UTM params. It must never touch
 * the checkout/webhook or fabricate a URL from a bad base.
 */

describe("slugify", () => {
  it("lower-cases and hyphenates, trimming edge runs", () => {
    expect(slugify("  Product Hunt Launch!!  ")).toBe("product-hunt-launch")
    expect(slugify("Q1  Newsletter   Push")).toBe("q1-newsletter-push")
  })
  it("returns empty for input with no usable characters", () => {
    expect(slugify("!!!   ???")).toBe("")
    expect(slugify("")).toBe("")
  })
  it("caps length", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(64)
  })
})

describe("channelToUtmMedium", () => {
  it("maps known channels and falls back to other", () => {
    expect(channelToUtmMedium("email")).toBe("email")
    expect(channelToUtmMedium("seo")).toBe("organic")
    expect(channelToUtmMedium("social")).toBe("social")
    expect(channelToUtmMedium("unknown")).toBe("other")
  })
})

describe("buildTrackedUrl", () => {
  it("appends UTM params to an absolute http(s) base, preserving existing query", () => {
    const out = buildTrackedUrl("https://acme.com/launch?ref=1", {
      utmSource: "atai",
      utmMedium: "social",
      utmCampaign: "product-hunt-launch",
    })
    expect(out.url).toContain("ref=1")
    expect(out.url).toContain("utm_source=atai")
    expect(out.url).toContain("utm_medium=social")
    expect(out.url).toContain("utm_campaign=product-hunt-launch")
  })
  it("omits empty/undefined params", () => {
    const out = buildTrackedUrl("https://acme.com", { utmSource: "atai", utmMedium: "  ", utmCampaign: undefined })
    expect(out.url).toBe("https://acme.com/?utm_source=atai")
  })
  it("preserves the fragment", () => {
    const out = buildTrackedUrl("https://acme.com/pricing#plans", { utmSource: "atai" })
    expect(out.url).toContain("#plans")
  })
  it("refuses a relative or non-http base WITHOUT producing a URL", () => {
    expect(buildTrackedUrl("/relative", { utmSource: "atai" }).url).toBeNull()
    expect(buildTrackedUrl("javascript:alert(1)", { utmSource: "atai" }).url).toBeNull()
    expect(buildTrackedUrl("ftp://acme.com", { utmSource: "atai" }).url).toBeNull()
    expect(buildTrackedUrl("javascript:alert(1)", { utmSource: "atai" }).reason).toBeTruthy()
  })
})
