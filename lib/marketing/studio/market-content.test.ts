import { describe, expect, it } from "vitest"
import {
  buildMarketMessages,
  buildVisualPrompt,
  clean,
  isMarketContentKind,
  MARKET_KIND_META,
  marketTitle,
  maxTokensFor,
} from "./market-content"

describe("market content vocabulary", () => {
  it("recognizes exactly the seven studio kinds", () => {
    for (const kind of ["copy", "email", "social", "timeline", "image", "voice", "video"]) {
      expect(isMarketContentKind(kind)).toBe(true)
      expect(MARKET_KIND_META[kind as keyof typeof MARKET_KIND_META]).toBeDefined()
    }
    expect(isMarketContentKind("podcast")).toBe(false)
  })

  it("maps each kind to the runtime capability that actually produces it", () => {
    expect(MARKET_KIND_META.copy.capability).toBe("ai.text")
    expect(MARKET_KIND_META.email.capability).toBe("ai.text")
    expect(MARKET_KIND_META.social.capability).toBe("ai.text")
    expect(MARKET_KIND_META.timeline.capability).toBe("ai.text")
    expect(MARKET_KIND_META.image.capability).toBe("ai.image")
    expect(MARKET_KIND_META.voice.capability).toBe("ai.speech")
    expect(MARKET_KIND_META.video.capability).toBe("ai.video")
  })
})

describe("buildMarketMessages", () => {
  it("includes the brief, brand voice, tone, language, and anti-fabrication rules", () => {
    const { system, prompt } = buildMarketMessages({
      kind: "email",
      projectName: "Acme",
      brandVoice: "Confident, concrete, never hype.",
      brief: {
        kind: "email",
        brief: "Launch our new analytics dashboard to existing customers.",
        tone: "confident",
        language: "English",
        audience: "Operations leads",
        length: "short",
      },
    })
    expect(system).toContain("Never invent numbers")
    expect(system).toContain("marketing email")
    expect(prompt).toContain("Acme")
    expect(prompt).toContain("Confident, concrete")
    expect(prompt).toContain("Launch our new analytics dashboard")
    expect(prompt).toContain("Operations leads")
    expect(prompt).toContain("Tone: confident")
  })

  it("names every requested social channel", () => {
    const { prompt } = buildMarketMessages({
      kind: "social",
      projectName: "Acme",
      brandVoice: "",
      brief: {
        kind: "social",
        brief: "Launch week",
        channels: ["instagram", "linkedin"],
      },
    })
    expect(prompt).toContain("instagram, linkedin")
    expect(prompt).toContain("one platform-native post for EACH requested channel")
  })

  it("asks for a spoken-only voiceover script", () => {
    const { system } = buildMarketMessages({
      kind: "voice",
      projectName: "Acme",
      brandVoice: "",
      brief: { kind: "voice", brief: "15 second teaser" },
    })
    expect(system).toContain("Return ONLY the spoken words")
  })
})

describe("buildVisualPrompt", () => {
  it("builds a bounded image prompt with brand direction and no text overlays", () => {
    const prompt = buildVisualPrompt({
      kind: "image",
      projectName: "Acme",
      brandVoice: "Warm, minimal, editorial.",
      brief: { kind: "image", brief: "A founder using the product on a laptop", aspectRatio: "4:5" },
    })
    expect(prompt).toContain("Acme")
    expect(prompt).toContain("Warm, minimal")
    expect(prompt).toContain("4:5")
    expect(prompt).toContain("No text overlays")
  })

  it("adds duration and motion guidance for video", () => {
    const prompt = buildVisualPrompt({
      kind: "video",
      projectName: "Acme",
      brandVoice: "",
      brief: { kind: "video", brief: "Slow push into a storefront", durationSeconds: 8 },
    })
    expect(prompt).toContain("8 seconds")
    expect(prompt).toContain("camera motion")
    expect(prompt).toContain("16:9")
  })
})

describe("clean + helpers", () => {
  it("strips control characters and bounds length", () => {
    expect(clean("hello\u0000 world\r\n\r\n\r\nnext", 100)).toBe("hello world\n\nnext")
    expect(clean("abcdef", 3)).toBe("abc")
  })

  it("caps text output tokens by requested length", () => {
    expect(maxTokensFor("short")).toBe(350)
    expect(maxTokensFor("long")).toBe(1600)
    expect(maxTokensFor(undefined)).toBe(900)
  })

  it("uses the project name in generated titles", () => {
    expect(marketTitle("image", "Acme")).toBe("Image for Acme")
  })
})
