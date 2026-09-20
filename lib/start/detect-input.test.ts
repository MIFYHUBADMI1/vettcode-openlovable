import { describe, expect, it } from "vitest"
import {
  detectStartMode,
  extractGithubRepo,
  extractWebsiteUrl,
  promptForStart,
  validateStartInput,
} from "./detect-input"

describe("extractGithubRepo", () => {
  it("reads full URLs and owner/repo shorthand", () => {
    expect(extractGithubRepo("https://github.com/vercel/next.js")).toBe("https://github.com/vercel/next.js")
    expect(extractGithubRepo("vercel/next.js")).toBe("vercel/next.js")
  })
})

describe("extractWebsiteUrl", () => {
  it("reads http URLs and ignores GitHub links", () => {
    expect(extractWebsiteUrl("Analyze https://linear.app for my clinic")).toBe("https://linear.app/")
    expect(extractWebsiteUrl("https://github.com/vercel/next.js")).toBeNull()
  })
})

describe("detectStartMode", () => {
  it("does not assume idea from ordinary text", () => {
    expect(detectStartMode("A booking app for clinics")).toBeNull()
    expect(detectStartMode("https://linear.app")).toBe("url")
    expect(detectStartMode("github.com/vercel/next.js")).toBe("github")
  })
})

describe("promptForStart", () => {
  it("keeps the original request for every mode", () => {
    expect(promptForStart("idea", "A booking app for clinics")).toBe("A booking app for clinics")
    expect(promptForStart("url", "Look at https://linear.app please")).toBe("Look at https://linear.app please")
  })
})

describe("validateStartInput", () => {
  it("asks for a URL in URL/mirror modes", () => {
    expect(validateStartInput("url", "just an idea")).toMatch(/valid website URL/i)
    expect(validateStartInput("github", "not a repo")).toMatch(/GitHub repository/i)
    expect(validateStartInput("idea", "")).toMatch(/build first/i)
  })
})
