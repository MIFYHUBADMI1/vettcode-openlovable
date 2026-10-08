import "server-only"
import { z } from "zod"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
  NormalizedProviderUsage,
} from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { RECOMMENDED_DEFAULT_MODEL } from "./mapper"

/**
 * Atai Runtime — OpenRouter multimodal mappers (server-only).
 *
 * Covers the dedicated OpenRouter endpoints beyond chat completions:
 *
 *   POST {base}/images               → ai.image/generateImage
 *   POST {base}/videos               → ai.video/generateVideo (async job)
 *   POST {base}/audio/speech         → ai.speech/speak (MP3/PCM bytes)
 *   POST {base}/audio/transcriptions → ai.transcribe/transcribe
 *   POST {base}/chat/completions     → ai.vision/visionInput (multimodal content)
 *
 * Same invariants as the chat mapper: strict zod validation of caller input,
 * deliberate field-by-field translation, provider-neutral normalized output,
 * and ProviderExecutionError("unsupported_operation") for schema violations so
 * bad input is a normalized 422-class failure — never a raw provider error.
 *
 * @module lib/runtime/router/adapters/openrouter/multimodal
 */

// ─── Shared helpers ─────────────────────────────────────────────────────────

/** Model id shape shared with the chat mapper (same allowlist pattern). */
const ModelId = z.string().min(1).max(200).regex(/^[\w.\/:-]+$/, "Invalid model identifier")

/** Resolve the model for a multimodal call (same resolution order as chat). */
export function resolveMultimodalModel(
  requested: string | undefined,
  projectDefault: string | undefined,
): string {
  return requested || projectDefault || process.env.OPENROUTER_DEFAULT_MODEL || RECOMMENDED_DEFAULT_MODEL
}

function invalid(detail: string): never {
  throw new ProviderExecutionError(
    "unsupported_operation",
    "The request body is invalid for this capability.",
    detail,
  )
}

/** Normalize OpenRouter's usage object into the billable normalized shape. */
export function normalizeMultimodalUsage(raw: unknown): NormalizedProviderUsage | undefined {
  if (typeof raw !== "object" || raw === null) return undefined
  const u = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined)
  const inputTokens = num(u.prompt_tokens) ?? 0
  const outputTokens = num(u.completion_tokens) ?? 0
  const totalTokens = num(u.total_tokens)
  return {
    inputTokens,
    outputTokens,
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(num(u.cost) !== undefined
      ? {
          providerCost: num(u.cost),
          providerCostCurrency: "USD",
          providerCostSource: "provider_reported" as const,
        }
      : {}),
  }
}

// ─── ai.image / generateImage — POST {base}/images ──────────────────────────

export const ImageInputSchema = z
  .object({
    model: ModelId.optional(),
    prompt: z.string().min(1).max(10_000),
    /** Resolution tier: 512 | 768 | 1K | 1.5K | 2K | 4K (provider-clamped). */
    resolution: z.enum(["512", "768", "1K", "1.5K", "2K", "4K"]).optional(),
    /** Normalized aspect ratio, e.g. "1:1", "16:9", "9:16", or "auto". */
    aspect_ratio: z.string().max(10).optional(),
    /** Explicit pixel size ("2048x2048") — overrides resolution/aspect_ratio. */
    size: z.string().max(20).optional(),
    quality: z.enum(["auto", "low", "medium", "high"]).optional(),
    output_format: z.enum(["png", "jpeg", "webp", "svg"]).optional(),
    background: z.enum(["auto", "transparent", "opaque"]).optional(),
    /** 1–10 images per call (provider-dependent support). */
    n: z.number().int().min(1).max(10).optional(),
    /** Reference images for image-to-image guidance (URL or data URL). */
    input_references: z
      .array(z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string().min(1).max(200_000) }) }))
      .max(10)
      .optional(),
    seed: z.number().int().optional(),
  })
  .strict()

export type ImageInput = z.infer<typeof ImageInputSchema>

export interface OpenRouterImageRequest {
  model: string
  prompt: string
  resolution?: string
  aspect_ratio?: string
  size?: string
  quality?: string
  output_format?: string
  background?: string
  n?: number
  input_references?: Array<{ type: "image_url"; image_url: { url: string } }>
  seed?: number
}

/** OpenRouter images response: base64 images + usage. */
export interface OpenRouterImageResponse {
  created?: number
  data: Array<{ b64_json?: unknown; media_type?: unknown }>
  usage?: unknown
}

export function toOpenRouterImageRequest(input: unknown, projectDefault?: string): OpenRouterImageRequest {
  const parsed = ImageInputSchema.safeParse(input)
  if (!parsed.success) {
    invalid(`image input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${parsed.error.issues[0]?.message ?? ""}`.trim())
  }
  return { model: resolveMultimodalModel(parsed.data.model, projectDefault), ...stripModel(parsed.data) }
}

export function toImageResult(
  response: OpenRouterImageResponse,
  request: ProviderExecutionRequest,
): ProviderExecutionResponse {
  const images = (response.data ?? [])
    .filter((d) => typeof d?.b64_json === "string" && (d as { b64_json: string }).b64_json.length > 0)
    .map((d) => ({
      b64: (d as { b64_json: string }).b64_json,
      ...(typeof d.media_type === "string" ? { mediaType: d.media_type } : {}),
    }))
  if (images.length === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The AI provider returned an error.",
      "image generation produced no images",
    )
  }
  return {
    provider: "openrouter",
    data: {
      images,
      model: "see request",
      capability: request.request.capability,
    },
    usage: normalizeMultimodalUsage(response.usage),
  }
}

// ─── ai.video / generateVideo — POST {base}/videos (async job) ──────────────

export const VideoInputSchema = z
  .object({
    model: ModelId.optional(),
    prompt: z.string().min(1).max(10_000),
    /** Duration seconds (provider-clamped). */
    duration: z.number().min(1).max(60).optional(),
    resolution: z.string().max(20).optional(),
    aspect_ratio: z.string().max(10).optional(),
  })
  .strict()

export type VideoInput = z.infer<typeof VideoInputSchema>

export interface OpenRouterVideoSubmit {
  model: string
  prompt: string
  duration?: number
  resolution?: string
  aspect_ratio?: string
}

export interface OpenRouterVideoJobResponse {
  id?: unknown
  status?: unknown
  [key: string]: unknown
}

export function toOpenRouterVideoRequest(input: unknown, projectDefault?: string): OpenRouterVideoSubmit {
  const parsed = VideoInputSchema.safeParse(input)
  if (!parsed.success) {
    invalid(`video input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${parsed.error.issues[0]?.message ?? ""}`.trim())
  }
  return { model: resolveMultimodalModel(parsed.data.model, projectDefault), ...stripModel(parsed.data) }
}

/**
 * Video generation is ASYNC on OpenRouter: submit returns a job. We return
 * the job id + status verbatim (safe scalars) — the generated app polls via
 * the same operation with { jobId } to fetch the result.
 */
export const VideoPollSchema = z.object({ jobId: z.string().min(1).max(200) }).strict()

export function toVideoResult(response: OpenRouterVideoJobResponse): ProviderExecutionResponse {
  const id = typeof response.id === "string" ? response.id : undefined
  const status = typeof response.status === "string" ? response.status : "submitted"
  return {
    provider: "openrouter",
    data: { jobId: id, status, raw: safeScalars(response) },
    usage: undefined,
  }
}

// ─── ai.speech / speak — POST {base}/audio/speech ───────────────────────────

export const SpeechInputSchema = z
  .object({
    model: ModelId.optional(),
    input: z.string().min(1).max(10_000),
    /** Provider voice id (e.g. "alloy"). Model-specific. */
    voice: z.string().min(1).max(100).optional(),
    response_format: z.enum(["mp3", "pcm"]).optional(),
    /** Tone/direction instructions (OpenAI-family models). */
    instructions: z.string().min(1).max(2000).optional(),
    speed: z.number().min(0.25).max(4).optional(),
  })
  .strict()

export type SpeechInput = z.infer<typeof SpeechInputSchema>

export interface OpenRouterSpeechRequest {
  model: string
  input: string
  voice?: string
  response_format?: string
  instructions?: string
  speed?: number
}

export function toOpenRouterSpeechRequest(input: unknown, projectDefault?: string): OpenRouterSpeechRequest {
  const parsed = SpeechInputSchema.safeParse(input)
  if (!parsed.success) {
    invalid(`speech input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${parsed.error.issues[0]?.message ?? ""}`.trim())
  }
  return { model: resolveMultimodalModel(parsed.data.model, projectDefault), ...stripModel(parsed.data) }
}

/** Speech returns raw audio bytes — normalized as base64 with its MIME type. */
export function toSpeechResult(bytes: ArrayBuffer, model: string): ProviderExecutionResponse {
  return {
    provider: "openrouter",
    data: { audioBase64: arrayBufferToBase64(bytes), mimeType: "audio/mpeg" },
    usage: undefined,
  }
}

// ─── ai.transcribe / transcribe — POST {base}/audio/transcriptions ──────────

export const TranscribeInputSchema = z
  .object({
    model: ModelId.optional(),
    /** Base64-encoded audio + its format (wav, mp3, flac, …). */
    input_audio: z.object({
      data: z.string().min(1).max(30_000_000),
      format: z.string().min(1).max(20),
    }),
    /** Optional language hint (improves non-English accuracy). */
    language: z.string().min(2).max(10).optional(),
    prompt: z.string().max(10_000).optional(),
  })
  .strict()

export type TranscribeInput = z.infer<typeof TranscribeInputSchema>

export interface OpenRouterTranscriptionRequest {
  model: string
  input_audio: { data: string; format: string }
  language?: string
  prompt?: string
}

export interface OpenRouterTranscriptionResponse {
  text?: unknown
  usage?: unknown
}

export function toOpenRouterTranscriptionRequest(input: unknown, projectDefault?: string): OpenRouterTranscriptionRequest {
  const parsed = TranscribeInputSchema.safeParse(input)
  if (!parsed.success) {
    invalid(`transcription input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${parsed.error.issues[0]?.message ?? ""}`.trim())
  }
  return { model: resolveMultimodalModel(parsed.data.model, projectDefault), ...stripModel(parsed.data) }
}

export function toTranscriptionResult(response: OpenRouterTranscriptionResponse): ProviderExecutionResponse {
  if (typeof response.text !== "string" || response.text.length === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The AI provider returned an error.",
      "transcription produced no text",
    )
  }
  return {
    provider: "openrouter",
    data: { text: response.text },
    usage: normalizeMultimodalUsage(response.usage),
  }
}

// ─── ai.vision / visionInput — POST {base}/chat/completions ─────────────────

/**
 * Multimodal chat: messages carry an array of typed content parts (text +
 * image_url / file / input_audio / video_url), mirroring OpenRouter's
 * OpenAI-compatible multimodal content schema.
 */
const ContentPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().min(1).max(100_000) }).strict(),
  z.object({ type: z.literal("image_url"), image_url: z.object({ url: z.string().min(1).max(2_000_000) }) }).strict(),
  z.object({ type: z.literal("file"), file: z.object({ filename: z.string().max(300).optional(), file_data: z.string().min(1).max(30_000_000) }) }).strict(),
  z.object({ type: z.literal("input_audio"), input_audio: z.object({ data: z.string().min(1).max(30_000_000), format: z.string().min(1).max(20) }) }).strict(),
  z.object({ type: z.literal("video_url"), video_url: z.object({ url: z.string().min(1).max(2_000_000) }) }).strict(),
])

export const VisionInputSchema = z
  .object({
    model: ModelId.optional(),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.union([z.string().min(1).max(100_000), z.array(ContentPartSchema).min(1).max(64)]),
        }),
      )
      .min(1)
      .max(64),
    max_tokens: z.number().int().min(1).max(1_000_000).optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict()

export type VisionInput = z.infer<typeof VisionInputSchema>

export interface OpenRouterVisionRequest {
  model: string
  messages: Array<{ role: string; content: unknown }>
  max_tokens?: number
  temperature?: number
}

export function toOpenRouterVisionRequest(input: unknown, projectDefault?: string): OpenRouterVisionRequest {
  const parsed = VisionInputSchema.safeParse(input)
  if (!parsed.success) {
    invalid(`vision input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${parsed.error.issues[0]?.message ?? ""}`.trim())
  }
  return {
    model: resolveMultimodalModel(parsed.data.model, projectDefault),
    messages: parsed.data.messages,
    ...(parsed.data.max_tokens !== undefined ? { max_tokens: parsed.data.max_tokens } : {}),
    ...(parsed.data.temperature !== undefined ? { temperature: parsed.data.temperature } : {}),
  }
}

/** Vision responses reuse the chat completion shape (choices[].message.content). */
export interface OpenRouterVisionResponse {
  id?: unknown
  model?: unknown
  choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }>
  usage?: unknown
}

export function toVisionResult(response: OpenRouterVisionResponse): ProviderExecutionResponse {
  const choice = response.choices?.[0]
  const content = choice?.message?.content
  if (typeof content !== "string" || content.length === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The AI provider returned an error.",
      "vision call produced no content",
    )
  }
  return {
    provider: "openrouter",
    data: {
      content,
      ...(typeof response.model === "string" ? { model: response.model } : {}),
    },
    usage: normalizeMultimodalUsage(response.usage),
  }
}

// ─── Small utilities ────────────────────────────────────────────────────────

/** Drop the model key from parsed data (already resolved into the body). */
function stripModel<T extends { model?: string }>(data: T): Omit<T, "model"> {
  const { model: _model, ...rest } = data
  return rest
}

/** Keep only JSON-safe scalars/nested structures from an untrusted job object. */
function safeScalars(value: unknown, depth = 0): unknown {
  if (depth > 3) return undefined
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => safeScalars(v, depth + 1))
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
      const cleaned = safeScalars(v, depth + 1)
      if (cleaned !== undefined) out[k] = cleaned
    }
    return out
  }
  return undefined
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
