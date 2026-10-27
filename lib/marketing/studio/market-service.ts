import "server-only"

import { ObjectId } from "mongodb"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import { store } from "@/lib/store/store"
import { cryptoId } from "@/lib/store/id"
import { contentItemsCol } from "@/lib/db/collections"
import { runtimeUsageCol } from "@/lib/db/runtime-collections"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { listApiKeys } from "@/lib/runtime/keys/service"
import { enforceProjectRuntimeLimits } from "@/lib/runtime/control/enforce-limits"
import { capabilityAvailability } from "@/lib/runtime/router/adapters/availability"
import { routeRuntimeRequest } from "@/lib/runtime/router/router"
import type { RuntimeAuthContext } from "@/runtime/contracts/auth"
import type { CapabilityScope } from "@/runtime/contracts/capabilities"
import type { RuntimeResponse } from "@/runtime/contracts/router"
import type {
  ContentItemDoc,
  MarketAssetBrief,
  MarketAssetMedia,
  MarketAssetRuntime,
  MarketAssetRuntimeCall,
} from "@/lib/types/db"
import { deriveBrandVoice } from "./generator"
import {
  RECOMMENDED_SPEECH_MODEL,
  RECOMMENDED_SPEECH_VOICE,
  RECOMMENDED_VIDEO_MODEL,
} from "@/lib/runtime/router/adapters/openrouter/multimodal"
import {
  buildMarketMessages,
  buildVisualPrompt,
  clean,
  isMarketContentKind,
  MARKET_KIND_META,
  marketTitle,
  type MarketBrief,
  type MarketContentKind,
} from "./market-content"

/**
 * Market & Grow AI studio (server-only).
 *
 * Every generation runs through the SAME runtime router as a real API call,
 * using the project's own identity:
 *
 *  1. If the project has an active API key that covers the capability, that
 *     key's id/scopes/environment are used (usage is attributed to it).
 *  2. Otherwise the signed-in owner's workspace identity is used with the full
 *     capability scope — no key secret is ever needed, created, or returned.
 *
 * Billing is the router's central metering path: credits are pre-charged per
 * request and recorded on `runtime_usage`, so the Business finances page sees
 * these generations automatically. Media binary is bounded before persistence.
 */

const MAX_STORED_MEDIA_CHARS = 4_500_000
const MAX_LIST_ITEMS = 30

/** Capabilities the studio can drive through the project runtime. */
export const MARKET_CAPABILITIES = ["ai.text", "ai.image", "ai.speech", "ai.video"] as const

export type MarketCapability = (typeof MARKET_CAPABILITIES)[number]

export interface ProjectRuntimeIdentity {
  auth: RuntimeAuthContext
  keySource: "project_api_key" | "workspace"
  keyLabel: string
  keyPrefix?: string
}

/** True when a key's granted scopes allow the requested capability. */
export function scopesCover(scopes: readonly string[], capability: string): boolean {
  if (scopes.length === 0) return true
  return scopes.some(
    (scope) =>
      scope === capability ||
      scope.startsWith(`${capability}.`) ||
      capability.startsWith(`${scope}.`),
  )
}

/**
 * Resolve the runtime identity for a project's workspace actions.
 * Prefers a real active project key (production before development) whose
 * scopes cover the capability; falls back to the owner workspace identity.
 */
export async function resolveProjectRuntimeIdentity(input: {
  userId: string
  projectId: string
  capability: MarketCapability
}): Promise<ProjectRuntimeIdentity> {
  const keys = await listApiKeys(input.userId, input.projectId)
  const now = Date.now()

  const eligible = keys.filter(
    (key) =>
      key.status === "active" &&
      (key.expiresAt === undefined || key.expiresAt === null || key.expiresAt > now) &&
      scopesCover(key.scopes, input.capability),
  )
  eligible.sort((a, b) => {
    const envRank = (env: string) => (env === "production" ? 0 : 1)
    const byEnv = envRank(a.environment) - envRank(b.environment)
    return byEnv !== 0 ? byEnv : b.createdAt - a.createdAt
  })

  const key = eligible[0]
  if (key) {
    return {
      auth: {
        apiKeyId: key.id,
        userId: input.userId,
        projectId: input.projectId,
        environment: key.environment,
        scopes: key.scopes as CapabilityScope[],
      },
      keySource: "project_api_key",
      keyLabel: `${key.name} · ${key.keyPrefix}…`,
      keyPrefix: key.keyPrefix,
    }
  }

  return {
    auth: {
      // A stable, non-secret workspace identity. Usage is still attributed to
      // the project; no credential exists because none is needed.
      apiKeyId: `rkey_workspace_${input.projectId}`,
      userId: input.userId,
      projectId: input.projectId,
      environment: "production",
      // Empty scopes = all capabilities (RuntimeAuthContext contract).
      scopes: [],
    },
    keySource: "workspace",
    keyLabel: "Workspace session (no project API key found)",
  }
}

// ─── Runtime invocations ────────────────────────────────────────────────────

interface CallRecord {
  response: RuntimeResponse
  capability: MarketCapability
  operation: string
  model?: string
  creditsCharged: number
}

async function callRuntime(
  identity: ProjectRuntimeIdentity,
  request: { capability: MarketCapability; operation: string; input: Record<string, unknown> },
  model?: string,
): Promise<{ response: RuntimeResponse; creditsCharged: number }> {
  await enforceProjectRuntimeLimits(identity.auth)
  const response = await routeRuntimeRequest(identity.auth, request)
  const creditsCharged = await creditsForRequest(response.requestId)
  return { response, creditsCharged }
}

/** Read the charged amount the metering layer just persisted for this request. */
async function creditsForRequest(requestId: string): Promise<number> {
  try {
    const col = await runtimeUsageCol()
    const doc = await col.findOne(
      { requestId },
      { projection: { creditsCharged: 1 } },
    )
    return typeof doc?.creditsCharged === "number" ? doc.creditsCharged : 0
  } catch (e) {
    logger.warn("marketing.studio.market", "credit lookup failed (non-fatal)", {
      requestId,
      message: e instanceof Error ? e.message : String(e),
    })
    return 0
  }
}

// ─── Generation ─────────────────────────────────────────────────────────────

export interface GenerateMarketInput extends MarketBrief {
  userId: string
  projectId: string
}

export interface MarketCallView {
  requestId: string
  capability: string
  operation: string
  creditsCharged: number
  model?: string
}

export interface MarketContentView {
  id: string
  projectId: string
  kind: MarketContentKind
  title: string
  body: string
  model?: string
  creditsCharged: number
  createdAt: number
  updatedAt: number
  media?: MarketAssetMedia
  runtime: {
    keySource: "project_api_key" | "workspace"
    keyLabel: string
    totalCreditsCharged: number
    calls: MarketCallView[]
  }
  brief: MarketAssetBrief
}

/** Generate one asset and persist it. Billing happens inside the router. */
export async function generateMarketContent(input: GenerateMarketInput): Promise<MarketContentView> {
  if (!isMarketContentKind(input.kind)) throw new AppError("VALIDATION")
  const briefText = clean(input.brief ?? "", 2000)
  const hasScript = input.kind === "voice" && Boolean(input.script && clean(input.script, 4000))
  if (!briefText && !hasScript) throw new AppError("VALIDATION")

  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const { voice: brandVoice } = deriveBrandVoice(project.specification)
  const identity = await resolveProjectRuntimeIdentity({
    userId: input.userId,
    projectId: input.projectId,
    capability: MARKET_KIND_META[input.kind].capability,
  })

  const calls: CallRecord[] = []
  let body = ""
  let model: string | undefined
  let media: MarketAssetMedia | undefined

  const brief: MarketBrief = {
    kind: input.kind,
    brief: briefText,
    ...(input.tone ? { tone: input.tone } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.channels ? { channels: input.channels } : {}),
    ...(input.audience ? { audience: clean(input.audience, 400) } : {}),
    ...(input.length ? { length: input.length } : {}),
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.voiceStyle ? { voiceStyle: input.voiceStyle } : {}),
    ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
  }

  if (input.kind === "image" || input.kind === "video") {
    const prompt = buildVisualPrompt({ kind: input.kind, projectName: project.name, brandVoice, brief })
    body = prompt
    if (input.kind === "image") {
      model = defaultMediaModel("image")
      const result = await callRuntime(
        identity,
        {
          capability: "ai.image",
          operation: "generateImage",
          input: {
            model,
            prompt,
            aspect_ratio: input.aspectRatio ?? "1:1",
            quality: input.quality ?? "medium",
            output_format: "webp",
            n: 1,
          },
        },
        model,
      )
      calls.push({ response: result.response, capability: "ai.image", operation: "generateImage", model, creditsCharged: result.creditsCharged })
      const image = readImage(result.response)
      if (!image) throw new AppError("AI_UNAVAILABLE")
      media = { kind: "image", dataUrl: image.dataUrl, mimeType: image.mimeType }
    } else {
      model = defaultMediaModel("video")
      const result = await callRuntime(
        identity,
        {
          capability: "ai.video",
          operation: "generateVideo",
          input: {
            model,
            prompt,
            duration: input.durationSeconds ?? 4,
            aspect_ratio: input.aspectRatio ?? "16:9",
          },
        },
        model,
      )
      calls.push({ response: result.response, capability: "ai.video", operation: "generateVideo", model, creditsCharged: result.creditsCharged })
      const job = readVideoJob(result.response)
      media = {
        kind: "video",
        ...(job.jobId ? { jobId: job.jobId } : {}),
        status: job.status,
        ...(job.output !== undefined ? { providerOutput: job.output } : {}),
      }
      body = `${prompt}\n\nVideo job: ${job.jobId ?? "submitted"} — status: ${job.status}. Poll this job from the studio to fetch the finished clip.`
    }
  } else if (input.kind === "voice") {
    const script =
      input.script && clean(input.script, 4000)
        ? clean(input.script, 4000)
        : await generateTextBody({
            identity,
            projectName: project.name,
            brandVoice,
            brief,
            calls,
          })
    body = script
    model = defaultMediaModel("speech")
    // Voice ids are model-specific: only assume one when we know the model.
    const speechVoice =
      process.env.MARKET_SPEECH_VOICE || (model === RECOMMENDED_SPEECH_MODEL ? RECOMMENDED_SPEECH_VOICE : undefined)
    const result = await callRuntime(
      identity,
      {
        capability: "ai.speech",
        operation: "speak",
        input: {
          model,
          input: script,
          ...(speechVoice ? { voice: speechVoice } : {}),
          response_format: "mp3",
          ...(input.voiceStyle ? { instructions: `Speak in a ${input.voiceStyle} tone.` } : {}),
        },
      },
      model,
    )
    calls.push({ response: result.response, capability: "ai.speech", operation: "speak", model, creditsCharged: result.creditsCharged })
    const audio = readAudio(result.response)
    if (!audio) throw new AppError("AI_UNAVAILABLE")
    media = { kind: "audio", dataUrl: audio.dataUrl, mimeType: audio.mimeType }
  } else {
    body = await generateTextBody({ identity, projectName: project.name, brandVoice, brief, calls })
  }

  forcedMediaBound(media)

  const now = Date.now()
  const id = `content_${cryptoId()}`
  const totalCredits = calls.reduce((sum, call) => sum + call.creditsCharged, 0)
  const runtime: MarketAssetRuntime = {
    keySource: identity.keySource,
    apiKeyId: identity.auth.apiKeyId,
    keyLabel: identity.keyLabel,
    calls: calls.map(toCallView),
    totalCreditsCharged: totalCredits,
  }

  const doc: ContentItemDoc = {
    _id: new ObjectId(),
    id,
    userId: input.userId,
    projectId: input.projectId,
    kind: "marketing_asset",
    template: "market_studio",
    status: "draft",
    title: marketTitle(input.kind, project.name),
    body,
    version: 1,
    origin: "ai_generated_marketing_content",
    ...(model ? { model } : {}),
    creditsCharged: totalCredits,
    assetKind: input.kind,
    ...(media ? { media } : {}),
    runtime,
    brief: toBriefDoc(brief),
    createdAt: now,
    updatedAt: now,
  }

  await persist(doc, input.projectId)
  logger.info("marketing.studio.market", "asset generated", {
    projectId: input.projectId,
    contentId: id,
    kind: input.kind,
    keySource: identity.keySource,
    creditsCharged: totalCredits,
  })

  return toView(doc, { includeMedia: true })
}

async function generateTextBody(input: {
  identity: ProjectRuntimeIdentity
  projectName: string
  brandVoice: string
  brief: MarketBrief
  calls: CallRecord[]
}): Promise<string> {
  const { system, prompt } = buildMarketMessages({
    kind: input.brief.kind,
    projectName: input.projectName,
    brandVoice: input.brandVoice,
    brief: input.brief,
  })
  const result = await callRuntime(
    input.identity,
    {
      capability: "ai.text",
      operation: "chat",
      input: {
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        temperature: 0.75,
        max_tokens: input.brief.kind === "voice" ? 500 : input.brief.length === "long" ? 1600 : input.brief.length === "short" ? 350 : 900,
      },
    },
  )
  const text = readText(result.response)
  if (!text) throw new AppError("AI_UNAVAILABLE")
  input.calls.push({
    response: result.response,
    capability: "ai.text",
    operation: "chat",
    ...(text.model ? { model: text.model } : {}),
    creditsCharged: result.creditsCharged,
  })
  return text.content
}

/**
 * Poll an existing video job. Charged like any runtime call; updates the stored
 * asset's status/output rather than creating a second asset.
 */
export async function pollMarketVideo(input: {
  userId: string
  projectId: string
  contentId: string
}): Promise<MarketContentView> {
  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")

  const col = await contentItemsCol()
  const existing = (await col.findOne({
    id: input.contentId,
    projectId: input.projectId,
    kind: "marketing_asset",
    assetKind: "video",
  })) as unknown as ContentItemDoc | null
  if (!existing || existing.userId !== input.userId) throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")

  const jobId = existing.media?.jobId
  if (!jobId) throw new AppError("VALIDATION")

  const identity = await resolveProjectRuntimeIdentity({
    userId: input.userId,
    projectId: input.projectId,
    capability: "ai.video",
  })
  const model = existing.model ?? defaultMediaModel("video")
  const result = await callRuntime(
    identity,
    { capability: "ai.video", operation: "generateVideo", input: { jobId } },
    model,
  )
  const job = readVideoJob(result.response)
  if (job.status === "failed" || job.status === "error") {
    throw new AppError("AI_UNAVAILABLE")
  }

  const media: MarketAssetMedia = {
    ...(existing.media ?? { kind: "video" }),
    kind: "video",
    jobId,
    status: job.status,
    ...(job.output !== undefined ? { providerOutput: job.output } : {}),
  }
  const call = toCallView({
    response: result.response,
    capability: "ai.video",
    operation: "generateVideo",
    model,
    creditsCharged: result.creditsCharged,
  })
  const runtime: MarketAssetRuntime = {
    ...(existing.runtime ?? {
      keySource: identity.keySource,
      apiKeyId: identity.auth.apiKeyId,
      keyLabel: identity.keyLabel,
      calls: [],
      totalCreditsCharged: 0,
    }),
    calls: [...(existing.runtime?.calls ?? []), call],
    totalCreditsCharged: (existing.runtime?.totalCreditsCharged ?? 0) + result.creditsCharged,
  }
  const updated: ContentItemDoc = {
    ...existing,
    media,
    runtime,
    creditsCharged: (existing.creditsCharged ?? 0) + result.creditsCharged,
    updatedAt: Date.now(),
  }

  await col.updateOne(
    { id: input.contentId, projectId: input.projectId },
    {
      $set: {
        media,
        runtime,
        creditsCharged: updated.creditsCharged,
        updatedAt: updated.updatedAt,
      },
    },
  )
  return toView(updated, { includeMedia: true })
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listMarketContent(projectId: string, limit = MAX_LIST_ITEMS): Promise<MarketContentView[]> {
  const col = await contentItemsCol()
  const docs = await col
    .find(
      { projectId, kind: "marketing_asset" },
      // Data URLs are heavy: exclude them from lists and fetch on demand.
      { projection: { "media.dataUrl": 0 } },
    )
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), MAX_LIST_ITEMS))
    .toArray()
  return (docs as unknown as ContentItemDoc[]).map((doc) => toView(doc, { includeMedia: false }))
}

export async function getMarketContent(projectId: string, contentId: string): Promise<MarketContentView | null> {
  const col = await contentItemsCol()
  const doc = (await col.findOne({
    id: contentId,
    projectId,
    kind: "marketing_asset",
  })) as unknown as ContentItemDoc | null
  return doc ? toView(doc, { includeMedia: true }) : null
}

export async function deleteMarketContent(input: {
  userId: string
  projectId: string
  contentId: string
}): Promise<boolean> {
  const col = await contentItemsCol()
  const result = await col.deleteOne({
    id: input.contentId,
    projectId: input.projectId,
    userId: input.userId,
    kind: "marketing_asset",
  })
  return result.deletedCount > 0
}

/** Studio readiness for the page: capability availability + credit balance. */
export async function getMarketStudioState(userId: string, projectId: string) {
  const all = capabilityAvailability()
  const capabilities = MARKET_CAPABILITIES.map((capability) => {
    const entry = all[capability]
    return {
      capability,
      available: Boolean(entry?.configured),
      provider: entry?.provider ?? null,
      missingEnvVars: entry?.missingEnvVars ?? [],
    }
  })

  let available: number | null = null
  try {
    available = await getAvailableCredits(userId)
  } catch (e) {
    logger.warn("marketing.studio.market", "credit balance read failed (non-fatal)", {
      userId,
      message: e instanceof Error ? e.message : String(e),
    })
  }

  const identity = await resolveProjectRuntimeIdentity({ userId, projectId, capability: "ai.text" })
  return {
    capabilities,
    creditsAvailable: available,
    key: {
      source: identity.keySource,
      label: identity.keyLabel,
    },
    textConfigured: Boolean(all["ai.text"]?.configured),
  }
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function defaultMediaModel(kind: "image" | "speech" | "video"): string {
  if (kind === "image") {
    return process.env.MARKET_IMAGE_MODEL || process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image"
  }
  if (kind === "speech") {
    return process.env.MARKET_SPEECH_MODEL || process.env.OPENROUTER_SPEECH_MODEL || RECOMMENDED_SPEECH_MODEL
  }
  return process.env.MARKET_VIDEO_MODEL || process.env.OPENROUTER_VIDEO_MODEL || RECOMMENDED_VIDEO_MODEL
}

function readText(response: RuntimeResponse): { content: string; model?: string } | null {
  const data = response.data as { content?: unknown; model?: unknown } | null
  if (!data || typeof data.content !== "string" || !data.content.trim()) return null
  return {
    content: data.content.trim(),
    ...(typeof data.model === "string" && data.model ? { model: data.model } : {}),
  }
}

function readImage(response: RuntimeResponse): { dataUrl: string; mimeType: string } | null {
  const data = response.data as { images?: unknown } | null
  const images = data && Array.isArray(data.images) ? data.images : []
  const first = images.find(
    (image): image is { b64: string; mediaType?: string } =>
      typeof image === "object" &&
      image !== null &&
      typeof (image as { b64?: unknown }).b64 === "string" &&
      ((image as { b64: string }).b64.length > 0),
  )
  if (!first) return null
  const mimeType = typeof first.mediaType === "string" && first.mediaType ? first.mediaType : "image/webp"
  return { dataUrl: `data:${mimeType};base64,${first.b64}`, mimeType }
}

function readAudio(response: RuntimeResponse): { dataUrl: string; mimeType: string } | null {
  const data = response.data as { audioBase64?: unknown; mimeType?: unknown } | null
  if (!data || typeof data.audioBase64 !== "string" || !data.audioBase64) return null
  const mimeType = typeof data.mimeType === "string" && data.mimeType ? data.mimeType : "audio/mpeg"
  // A data URI takes `type/subtype` only — strip PCM parameters like
  // `;rate=24000;channels=1` or the URI is malformed.
  const baseMime = mimeType.split(";")[0] || "audio/mpeg"
  return { dataUrl: `data:${baseMime};base64,${data.audioBase64}`, mimeType }
}

function readVideoJob(response: RuntimeResponse): { jobId?: string; status: string; output?: unknown } {
  const data = response.data as { jobId?: unknown; status?: unknown; raw?: unknown } | null
  return {
    ...(typeof data?.jobId === "string" && data.jobId ? { jobId: data.jobId } : {}),
    status: typeof data?.status === "string" ? data.status : "submitted",
    ...(data?.raw !== undefined ? { output: data.raw } : {}),
  }
}

/** Mark media that is too large to persist, keeping the live response usable. */
function forcedMediaBound(media: MarketAssetMedia | undefined): void {
  if (!media) return
  if (media.dataUrl && media.dataUrl.length > MAX_STORED_MEDIA_CHARS) {
    media.notPersisted = true
    delete media.dataUrl
  }
}

function toCallView(call: CallRecord): MarketCallView {
  return {
    requestId: call.response.requestId,
    capability: call.capability,
    operation: call.operation,
    creditsCharged: call.creditsCharged,
    ...(call.model ? { model: call.model } : {}),
  }
}

function toBriefDoc(brief: MarketBrief): MarketAssetBrief {
  return {
    brief: brief.brief,
    ...(brief.tone ? { tone: brief.tone } : {}),
    ...(brief.language ? { language: brief.language } : {}),
    ...(brief.channel ? { channel: brief.channel } : {}),
    ...(brief.audience ? { audience: brief.audience } : {}),
    ...(brief.aspectRatio ? { aspectRatio: brief.aspectRatio } : {}),
    ...(brief.durationSeconds ? { durationSeconds: brief.durationSeconds } : {}),
    ...(brief.voiceStyle ? { voiceStyle: brief.voiceStyle } : {}),
  }
}

function toView(doc: ContentItemDoc, options: { includeMedia: boolean }): MarketContentView {
  const media = doc.media
    ? {
        ...doc.media,
        ...(options.includeMedia ? {} : { dataUrl: undefined }),
      }
    : undefined
  if (media && !options.includeMedia) delete media.dataUrl

  return {
    id: doc.id,
    projectId: doc.projectId,
    kind: (doc.assetKind ?? "copy") as MarketContentKind,
    title: doc.title,
    body: doc.body,
    ...(doc.model ? { model: doc.model } : {}),
    creditsCharged: doc.creditsCharged ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(media ? { media } : {}),
    runtime: {
      keySource: doc.runtime?.keySource ?? "workspace",
      keyLabel: doc.runtime?.keyLabel ?? "Workspace session",
      totalCreditsCharged: doc.runtime?.totalCreditsCharged ?? doc.creditsCharged ?? 0,
      calls: doc.runtime?.calls ?? [],
    },
    brief: doc.brief ?? { brief: "" },
  }
}

async function persist(doc: ContentItemDoc, projectId: string): Promise<void> {
  try {
    const col = await contentItemsCol()
    await col.insertOne(doc as never)
  } catch (e) {
    logger.error("marketing.studio.market", "failed to persist asset", {
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("DATABASE_UNAVAILABLE")
  }
}

/** Re-exported for callers that only need the kind list. */
export type { MarketContentKind }
