/**
 * Atai Runtime — OpenRouter multimodal mapper tests.
 *
 * Covers strict input validation, model resolution (caller > project default >
 * platform default > recommended), and provider-neutral result normalization
 * for the image, video, speech, transcription, and vision operations.
 * No test requires real OpenRouter connectivity.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  toOpenRouterImageRequest,
  toImageResult,
  toOpenRouterVideoRequest,
  toVideoResult,
  toOpenRouterSpeechRequest,
  toSpeechResult,
  toOpenRouterTranscriptionRequest,
  toTranscriptionResult,
  toOpenRouterVisionRequest,
  toVisionResult,
  resolveMultimodalModel,
} from "./multimodal"
import { RECOMMENDED_DEFAULT_MODEL } from "./mapper"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

const auth = {
  apiKeyId: "rkey_test",
  userId: "user_test",
  projectId: "proj_test",
  environment: "development" as const,
  scopes: [],
}

function executionRequest(capability: string, operation: string, input?: unknown) {
  return {
    auth,
    requestId: "rtreq_test",
    request: { capability, operation, ...(input !== undefined ? { input } : {}) },
  } as Parameters<typeof toImageResult>[1]
}

describe("resolveMultimodalModel", () => {
  it("caller model wins, then project default, then platform default, then recommended", () => {
    process.env.OPENROUTER_DEFAULT_MODEL = "openai/gpt-test"
    expect(resolveMultimodalModel("a/b", "c/d")).toBe("a/b")
    expect(resolveMultimodalModel(undefined, "c/d")).toBe("c/d")
    expect(resolveMultimodalModel(undefined, undefined)).toBe("openai/gpt-test")
    delete process.env.OPENROUTER_DEFAULT_MODEL
    expect(resolveMultimodalModel(undefined, undefined)).toBe(RECOMMENDED_DEFAULT_MODEL)
  })
})

describe("ai.image / generateImage", () => {
  it("builds the request with resolved model and passes image options", () => {
    const body = toOpenRouterImageRequest({
      prompt: "a cat",
      resolution: "2K",
      aspect_ratio: "16:9",
      n: 2,
      input_references: [{ type: "image_url", image_url: { url: "https://example.com/r.png" } }],
    }, "openai/gpt-image-2")
    expect(body.model).toBe("openai/gpt-image-2")
    expect(body.prompt).toBe("a cat")
    expect(body.resolution).toBe("2K")
    expect(body.n).toBe(2)
    expect(body.input_references).toHaveLength(1)
  })

  it("rejects unknown fields and bad values", () => {
    expect(() => toOpenRouterImageRequest({ prompt: "x", hacker: true })).toThrow(ProviderExecutionError)
    expect(() => toOpenRouterImageRequest({ prompt: "" })).toThrow(ProviderExecutionError)
    expect(() => toOpenRouterImageRequest({ prompt: "x", n: 99 })).toThrow(ProviderExecutionError)
  })

  it("normalizes base64 images; no images → provider error", () => {
    const result = toImageResult(
      { data: [{ b64_json: "abc", media_type: "image/png" }], usage: { prompt_tokens: 0, completion_tokens: 100, total_tokens: 100, cost: 0.04 } },
      executionRequest("ai.image", "generateImage"),
    )
    expect(result.provider).toBe("openrouter")
    expect(result.data).toMatchObject({ images: [{ b64: "abc", mediaType: "image/png" }] })
    expect(result.usage?.outputTokens).toBe(100)
    expect(result.usage?.providerCost).toBe(0.04)
    expect(() => toImageResult({ data: [] }, executionRequest("ai.image", "generateImage"))).toThrow(ProviderExecutionError)
  })
})

describe("ai.video / generateVideo", () => {
  it("submits with resolved model", () => {
    const body = toOpenRouterVideoRequest({ prompt: "a rocket launch", duration: 5 }, "google/veo-3")
    expect(body.model).toBe("google/veo-3")
    expect(body.duration).toBe(5)
  })

  it("normalizes the async job response", () => {
    const result = toVideoResult({ id: "job_123", status: "submitted", eta_seconds: 30 })
    expect(result.data).toMatchObject({ jobId: "job_123", status: "submitted" })
  })
})

describe("ai.speech / speak", () => {
  it("builds the speech request", () => {
    const body = toOpenRouterSpeechRequest({ input: "Hello!", voice: "alloy", response_format: "mp3" }, "openai/gpt-4o-mini-tts")
    expect(body.model).toBe("openai/gpt-4o-mini-tts")
    expect(body.voice).toBe("alloy")
  })

  it("normalizes raw audio bytes into base64", () => {
    const bytes = new TextEncoder().encode("fake-mp3-bytes").buffer as ArrayBuffer
    const result = toSpeechResult(bytes, "openai/gpt-4o-mini-tts")
    expect(result.data).toMatchObject({ mimeType: "audio/mpeg" })
    expect((result.data as { audioBase64: string }).audioBase64.length).toBeGreaterThan(0)
  })
})

describe("ai.transcribe / transcribe", () => {
  it("builds the transcription request", () => {
    const body = toOpenRouterTranscriptionRequest(
      { input_audio: { data: "AAAA", format: "wav" }, language: "en" },
      "openai/whisper-large-v3",
    )
    expect(body.model).toBe("openai/whisper-large-v3")
    expect(body.input_audio).toEqual({ data: "AAAA", format: "wav" })
  })

  it("normalizes text; empty text → provider error", () => {
    const result = toTranscriptionResult({ text: "hello world", usage: { total_tokens: 5 } })
    expect(result.data).toEqual({ text: "hello world" })
    expect(() => toTranscriptionResult({ text: "" })).toThrow(ProviderExecutionError)
  })
})

describe("ai.vision / visionInput", () => {
  it("accepts multimodal content parts (image_url + text)", () => {
    const body = toOpenRouterVisionRequest({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this image?" },
            { type: "image_url", image_url: { url: "https://example.com/cat.png" } },
          ],
        },
      ],
      max_tokens: 300,
    }, "openai/gpt-5.2")
    expect(body.model).toBe("openai/gpt-5.2")
    expect(Array.isArray(body.messages[0].content)).toBe(true)
    expect(body.max_tokens).toBe(300)
  })

  it("rejects unknown content-part types", () => {
    expect(() =>
      toOpenRouterVisionRequest({
        messages: [{ role: "user", content: [{ type: "exec", code: "rm -rf /" }] }],
      }),
    ).toThrow(ProviderExecutionError)
  })

  it("normalizes the chat-shaped response", () => {
    const result = toVisionResult({
      id: "gen-1",
      model: "openai/gpt-5.2",
      choices: [{ finish_reason: "stop", message: { content: "A cat sits on a mat." } }],
      usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
    })
    expect(result.data).toMatchObject({ content: "A cat sits on a mat.", model: "openai/gpt-5.2" })
    expect(result.usage?.totalTokens).toBe(18)
    expect(() => toVisionResult({ choices: [] })).toThrow(ProviderExecutionError)
  })
})
