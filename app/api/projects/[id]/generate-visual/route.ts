import { NextRequest } from "next/server"
import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { consumeCredits, getAvailableCredits } from "@/lib/billing/credit-service"
import { projectAssetsCol } from "@/lib/db/collections"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { uploadImageToImageKit } from "@/lib/imagekit/upload"
import {
  getOpenRouterBaseUrl,
  isOpenRouterConfigured,
  openRouterHeaders,
} from "@/lib/runtime/router/adapters/openrouter/config"
import { computeVisualCredits, VISUAL_FALLBACK_CREDITS } from "@/lib/billing/visual-pricing"
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  type VisualMockupRequest,
  type VisualMockupResponse,
} from "@/lib/types/visual-mockup"
import { getPlanSection } from "@/lib/analysis/plan-sections"

/** Generous ceiling — flagship image models can take minutes to render. */
const GENERATION_TIMEOUT_MS = 120_000

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id: projectId } = await params
    const project = await store.getProject(projectId)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const sectionId = req.nextUrl.searchParams.get("sectionId")
    const col = await projectAssetsCol()
    const assets = await (sectionId
      ? col.find({ projectId, kind: "asset", "metadata.sectionId": sectionId })
      : col.find({ projectId, kind: "asset", "metadata.sectionId": { $exists: true } })
    )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    return ok({
      visuals: assets.map((a) => ({
        id: a.id,
        imageUrl: a.url,
        model: typeof a.metadata?.model === "string" ? a.metadata.model : undefined,
        creditsConsumed: typeof a.metadata?.creditsConsumed === "number" ? a.metadata.creditsConsumed : 0,
        createdAt: a.createdAt,
        sectionId: typeof a.metadata?.sectionId === "string" ? a.metadata.sectionId : undefined,
        aspectRatio: typeof a.metadata?.aspectRatio === "string" ? a.metadata.aspectRatio : undefined,
        prompt: typeof a.metadata?.prompt === "string" ? a.metadata.prompt : "",
      })),
    })
  } catch (error) {
    return handleRouteError("api.projects.generate-visual.list", error)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id: projectId } = await params

    const body: VisualMockupRequest = await req.json()
    const { sectionId, model = DEFAULT_IMAGE_MODEL, aspectRatio = "16:9", style } = body

    const project = await store.getProject(projectId)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const sectionDef = getPlanSection(sectionId)
    if (!sectionDef) {
      return fail("VALIDATION", "Invalid section ID.", 400)
    }

    const spec = project.specification
    if (!spec) {
      return fail("VALIDATION", "Project specification not available.", 400)
    }

    const modelInfo = IMAGE_MODELS.find((m) => m.id === model)
    if (!modelInfo) {
      return fail("VALIDATION", "Unknown image model.", 422)
    }

    if (!isOpenRouterConfigured()) {
      return fail(
        "PROVIDER_NOT_CONFIGURED",
        "Image generation isn't connected yet. Add your OpenRouter API key to enable it.",
        503,
      )
    }

    const sectionContent = sectionDef.read(spec)
    const appContext = `${spec.title || project.name || "Application"}: ${spec.description || project.idea || ""}`
    const prompt = buildVisualPrompt({
      appContext,
      sectionLabel: sectionDef.label,
      sectionContent,
      style,
    })

    // Upfront balance check: flat-priced models need their fixed cost;
    // premium models are charged at most the no-cost fallback (1600) until
    // OpenRouter reports the real price with the image.
    const upfrontCredits = modelInfo.fixedCreditCost ?? VISUAL_FALLBACK_CREDITS
    const available = await getAvailableCredits(user.id)
    if (available < upfrontCredits) {
      return fail(
        "INSUFFICIENT_CREDITS",
        `You need ${upfrontCredits.toLocaleString()} credits for this image. Available: ${available.toLocaleString()}.`,
        402,
      )
    }

    const startTime = Date.now()
    let result: { imageUrl: string; cost?: number }
    try {
      result = await generateImageViaOpenRouter({
        model,
        prompt,
        aspectRatio,
        projectId,
        sectionLabel: sectionDef.label,
      })
    } catch (error) {
      // Generation failed → nothing was produced, so nothing is charged.
      console.error("[generate-visual] Provider error:", error)
      return fail(
        "AI_UNAVAILABLE",
        "The image couldn't be generated — you were not charged. Please try again.",
        502,
      )
    }
    const generationTime = Date.now() - startTime

    // Pricing: default model = flat 100 credits; premium = provider cost +
    // 45% margin at $1 = 4000 credits; premium without a reported cost = 1600.
    const { credits, finalCost } = computeVisualCredits({
      fixedCreditCost: modelInfo.fixedCreditCost,
      providerCost: result.cost ?? null,
    })

    const charged = await consumeCredits({
      userId: user.id,
      amount: credits,
      transactionType: "ai_collaboration",
      idempotencyKey: `visual_${cryptoId()}`,
      referenceType: "project",
      referenceId: projectId,
      // Trusted server-side context from the route (user must own the
      // project). Persisted on the ledger as first-class projectId.
      projectId,
      metadata: {
        reason: "Expected visual generation",
        feature: "expected-visuals",
        sectionId,
        model,
        providerCost: result.cost ?? null,
        finalCost: finalCost ?? null,
        aspectRatio,
      },
    })
    if (!charged.success) {
      return fail(
        "INSUFFICIENT_CREDITS",
        "You don't have enough credits to keep this image. Please top up and try again.",
        402,
      )
    }

    const response: VisualMockupResponse = {
      imageUrl: result.imageUrl,
      creditsConsumed: credits,
      model,
      providerCost: result.cost,
      finalCost,
      generationTime,
    }

    // Persist for future reference (best-effort — the image is already paid for).
    try {
      await (await projectAssetsCol()).insertOne({
        _id: new ObjectId(),
        id: `visual_${cryptoId()}`,
        userId: user.id,
        projectId,
        kind: "asset",
        fileId: `visual_${cryptoId()}`,
        filePath: result.imageUrl,
        fileName: `${sectionDef.label}-visual-${Date.now()}.png`,
        url: result.imageUrl,
        mimeType: "image/png",
        size: 0,
        createdAt: Date.now(),
        metadata: {
          sectionId,
          sectionLabel: sectionDef.label,
          model,
          creditsConsumed: credits,
          providerCost: result.cost ?? null,
          finalCost: finalCost ?? null,
          prompt: prompt.slice(0, 1000),
          aspectRatio,
        },
      })
    } catch (saveError) {
      console.error("[generate-visual] Failed to save asset:", saveError)
    }

    return ok(response)
  } catch (error) {
    console.error("[generate-visual] Error:", error)
    return handleRouteError("api.projects.generate-visual", error)
  }
}

function buildVisualPrompt(params: {
  appContext: string
  sectionLabel: string
  sectionContent: string
  style?: string
}): string {
  const { appContext, sectionLabel, sectionContent, style } = params
  let prompt = `Create a professional UI/UX mockup for the "${sectionLabel}" section of this application:\n\n`
  prompt += `Application: ${appContext}\n\n`
  prompt += `Section Details:\n${sectionContent.slice(0, 1000)}\n\n`
  prompt += `Style: Modern, clean, professional web application interface. `
  prompt += `Show realistic UI elements, proper spacing, readable typography. `
  if (style) prompt += `Additional style: ${style}. `
  prompt += `Focus on visual design that represents the functionality described above.`
  return prompt
}

async function generateImageViaOpenRouter(params: {
  model: string
  prompt: string
  aspectRatio: string
  projectId: string
  sectionLabel: string
}): Promise<{ imageUrl: string; cost?: number }> {
  const { model, prompt, aspectRatio, projectId, sectionLabel } = params

  const response = await fetch(`${getOpenRouterBaseUrl()}/images`, {
    method: "POST",
    headers: {
      ...openRouterHeaders(),
      "X-Title": "Atai",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://atai.ink",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
    }),
    signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    console.error("[generate-visual] OpenRouter error:", response.status, errorBody.slice(0, 500))
    throw new Error(`OpenRouter image generation failed with status ${response.status}`)
  }

  const data = await response.json()
  const first = Array.isArray(data?.data) ? data.data[0] : undefined
  if (!first) {
    throw new Error("OpenRouter returned no image data")
  }

  let imageUrl = typeof first.url === "string" ? first.url : ""
  if (!imageUrl && typeof first.b64_json === "string" && first.b64_json.length > 0) {
    const base64 = first.b64_json.replace(/^data:[^;]+;base64,/, "")
    const mimeType = typeof first.media_type === "string" ? first.media_type : "image/png"
    imageUrl = await persistGeneratedImage({ base64, mimeType, projectId, sectionLabel })
  }
  if (!imageUrl) {
    throw new Error("OpenRouter returned an empty image")
  }

  // Cost is reported alongside the image: usage header and/or usage body.
  let cost: number | undefined
  const usageHeader = response.headers.get("x-openrouter-usage")
  if (usageHeader) {
    try {
      const usage = JSON.parse(usageHeader)
      cost = usage.total_cost ?? usage.generation_cost ?? usage.cost
    } catch {
      /* ignore malformed usage header */
    }
  }
  if (cost == null && typeof data.usage?.cost === "number") cost = data.usage.cost
  if (cost == null && typeof data.usage?.total_cost === "number") cost = data.usage.total_cost
  if (cost != null && (!Number.isFinite(cost) || cost <= 0)) cost = undefined

  return { imageUrl, cost }
}

/**
 * The Image API returns base64 bytes. Upload them to ImageKit so saved
 * visuals get a durable URL for future reference; if ImageKit isn't
 * configured, fall back to an inline data URL so the preview still works.
 */
async function persistGeneratedImage(params: {
  base64: string
  mimeType: string
  projectId: string
  sectionLabel: string
}): Promise<string> {
  const { base64, mimeType, projectId, sectionLabel } = params
  const buffer = Buffer.from(base64, "base64")
  try {
    const upload = await uploadImageToImageKit({
      file: buffer,
      fileName: `${sectionLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-expected-visual-${Date.now()}.${extensionFor(mimeType)}`,
      mimeType,
      folder: `/Atai/projects/${projectId}/visuals`,
    })
    return upload.url
  } catch (error) {
    console.error("[generate-visual] ImageKit upload failed, using inline image:", error)
    return `data:${mimeType};base64,${base64}`
  }
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    default:
      return "png"
  }
}
