import { describe, expect, it } from "vitest"
import { buildCreatePayload } from "./continue-start"

describe("buildCreatePayload", () => {
  it("maps idea mode to scratch with the original prompt", () => {
    const payload = buildCreatePayload({
      prompt: "I want to build a marketplace connecting local farmers with restaurants.",
      href: "/start",
      mode: "idea",
    })
    expect(payload.mode).toBe("scratch")
    expect(payload.idea).toContain("farmers")
    expect(payload.pipelineMode).toBe("heavy")
    expect(payload.skipAnalysis).toBe(true)
  })

  it("keeps URL plus instruction for website mode", () => {
    const payload = buildCreatePayload({
      prompt: "https://example.com Turn this into a SaaS for African businesses.",
      href: "/start",
      mode: "website",
    })
    expect(payload.mode).toBe("website")
    expect(payload.url).toContain("example.com")
    expect(payload.idea).toContain("African businesses")
  })

  it("parses GitHub owner/name and uses extend when there is an instruction", () => {
    const payload = buildCreatePayload({
      prompt: "https://github.com/acme/app help me turn this into a product",
      href: "/start",
      mode: "github",
    })
    expect(payload.mode).toBe("github")
    expect(payload.githubRepoOwner).toBe("acme")
    expect(payload.githubRepoName).toBe("app")
    expect(payload.githubSubMode).toBe("extend")
  })
})
