import { describe, it, expect } from "vitest"
import { resolveChatModel, UNRESTRICTED_MODEL_POLICY } from "./model-policy"

describe("resolveChatModel", () => {
  it("uses the caller model when unrestricted (current platform behavior)", () => {
    const r = resolveChatModel("openai/gpt-4o", UNRESTRICTED_MODEL_POLICY, "openai/gpt-4o-mini")
    expect(r).toEqual({ ok: true, model: "openai/gpt-4o" })
  })

  it("falls back to platform default when no caller model", () => {
    const r = resolveChatModel(undefined, UNRESTRICTED_MODEL_POLICY, "openai/gpt-4o-mini")
    expect(r).toEqual({ ok: true, model: "openai/gpt-4o-mini" })
  })

  it("rejects a caller model outside the allowlist", () => {
    const r = resolveChatModel("openai/gpt-4o", {
      allowedModels: ["openai/gpt-4o-mini"],
      fallbackModels: [],
      allowEndUserModelSelection: true,
      defaultModel: "openai/gpt-4o-mini",
    }, "openai/gpt-4o-mini")
    expect(r).toEqual({ ok: false, error: "model_not_allowed" })
  })

  it("ignores caller model when end-user selection is disabled", () => {
    const r = resolveChatModel("openai/gpt-4o", {
      allowedModels: [],
      fallbackModels: ["google/gemini-2.0-flash"],
      allowEndUserModelSelection: false,
      defaultModel: "openai/gpt-4o-mini",
    }, "openai/gpt-4o")
    expect(r).toEqual({ ok: true, model: "openai/gpt-4o-mini" })
  })

  it("uses the first permitted fallback when default is disallowed", () => {
    const r = resolveChatModel(undefined, {
      allowedModels: ["google/gemini-2.0-flash"],
      fallbackModels: ["google/gemini-2.0-flash"],
      allowEndUserModelSelection: true,
      defaultModel: "openai/gpt-4o",
    }, "openai/gpt-4o")
    expect(r).toEqual({ ok: true, model: "google/gemini-2.0-flash" })
  })

  it("returns no_model when nothing is configured", () => {
    const r = resolveChatModel(undefined, UNRESTRICTED_MODEL_POLICY, undefined)
    expect(r).toEqual({ ok: false, error: "no_model" })
  })
})
