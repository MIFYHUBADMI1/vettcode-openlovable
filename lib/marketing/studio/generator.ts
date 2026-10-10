import "server-only"

/**
 * Marketing Studio generator (Phase 4 — W3).
 *
 * Splits a PURE, deterministic prompt-assembly layer from the single network
 * call, so the copy scaffolds and brand-voice derivation are reproducible and
 * unit-testable without touching the model. Generation reuses the repo's
 * canonical one-shot text handle (`MODEL` in `lib/analysis/model.ts`) + the `ai`
 * SDK `generateText`, exactly like the existing marketing-playbook route — no
 * new AI substrate, no model-registry reimplementation.
 *
 * Trust posture (carried from Phase 2 / Phase 3): this produces AI DRAFTS. The
 * output is a proposal, never a measured result, and it is always stored with an
 * `origin` that keeps it distinct from the founder-authored plan prose.
 */

import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type { StudioTemplate } from "@/lib/types/db"
import type { ApplicationSpecification } from "@/lib/types/specification"

/** Fixed, product-owned templates. The AI only fills these scaffolds. */
export const STUDIO_TEMPLATES: readonly StudioTemplate[] = [
  "landing_hero",
  "feature_blurb",
  "email_welcome",
  "ad_headline",
] as const

export function isStudioTemplate(value: string): value is StudioTemplate {
  return (STUDIO_TEMPLATES as readonly string[]).includes(value)
}

const TEMPLATE_META: Record<StudioTemplate, { label: string; instruction: string }> = {
  landing_hero: {
    label: "Landing page hero",
    instruction: "A headline (max 10 words) and one supporting sentence (max 28 words) for the product's landing page.",
  },
  feature_blurb: {
    label: "Feature blurb",
    instruction: "A short paragraph (max 45 words) describing ONE concrete benefit a user gets, in plain language.",
  },
  email_welcome: {
    label: "Welcome email",
    instruction: "A warm, brief welcome email body (max 120 words) with a subject line on its own first line prefixed 'Subject: '.",
  },
  ad_headline: {
    label: "Ad headline set",
    instruction: "Exactly 3 alternative short ad headlines, one per line, each max 30 characters.",
  },
}

export function studioTemplateLabel(template: StudioTemplate): string {
  return TEMPLATE_META[template].label
}

/**
 * Derive a compact "brand voice" from the plan sections the project ALREADY
 * holds. There is no dedicated brand-voice field in the specification, so this
 * assembles one from `brandIdentity` (visual/personality prose),
 * `marketingPlan`, `marketPositioning`, `valueProposition` and `targetUsers`.
 * Returns the contributing sources so the UI can be honest that the voice is
 * DERIVED FROM THE PLAN, not an independent measurement or a stored preference.
 */
export function deriveBrandVoice(spec: ApplicationSpecification | undefined): { voice: string; sources: string[] } {
  const parts: string[] = []
  const sources: string[] = []
  const add = (label: string, value?: string) => {
    const v = (value ?? "").trim()
    if (v) {
      parts.push(`${label}: ${truncate(v, 400)}`)
      sources.push(label)
    }
  }
  add("Brand & visual identity", spec?.brandIdentity)
  add("Value proposition", spec?.valueProposition)
  add("Market positioning", spec?.marketPositioning)
  add("Marketing plan", spec?.marketingPlan)
  const audience = (spec?.targetUsers ?? []).map((s) => (s ?? "").trim()).filter(Boolean).slice(0, 6)
  if (audience.length) {
    parts.push(`Target audience: ${audience.join(", ")}`)
    sources.push("Target audience")
  }
  return { voice: parts.join("\n"), sources }
}

/**
 * Build the exact system + user prompts for a generation. PURE: same inputs →
 * same strings. Includes an anti-fabrication instruction so the model does not
 * invent metrics, rankings, prices, or testimonials.
 */
export function buildTemplateMessages(input: {
  template: StudioTemplate
  projectName: string
  brandVoice: string
  brief?: string
}): { system: string; prompt: string } {
  const meta = TEMPLATE_META[input.template]
  const system =
    "You are a marketing copywriter inside a founder's product workspace. " +
    `Task: ${meta.instruction}\n` +
    "Write original copy in the provided brand voice. " +
    "Do NOT invent numbers, prices, statistics, rankings, reviews, testimonials, or claims about results or performance. " +
    "If a concrete fact is not provided, write around it rather than fabricating it. " +
    "Return only the requested copy — no preamble, no markdown fences."
  const brief = (input.brief ?? "").trim()
  const prompt =
    `Product name: ${input.projectName}\n\n` +
    `Brand voice (derived from this project's plan):\n${input.brandVoice.trim() || "(no brand voice on file — keep it neutral and specific to the product name)"}\n\n` +
    (brief ? `Extra direction from the founder: ${truncate(brief, 1000)}\n\n` : "") +
    `Now write: ${meta.instruction}`
  return { system, prompt }
}

export function isGenerationConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}

const GENERATION_TIMEOUT_MS = 60_000
const MAX_OUTPUT_TOKENS = 700

/** The single network boundary. Throws AppError(AI_UNAVAILABLE) when no key or
 * the provider call fails — the caller owns refunding. */
export async function generateCopy(input: {
  template: StudioTemplate
  projectName: string
  brandVoice: string
  brief?: string
}): Promise<{ text: string; model: string }> {
  if (!isGenerationConfigured()) {
    throw new AppError("AI_UNAVAILABLE")
  }
  const { system, prompt } = buildTemplateMessages(input)
  try {
    const result = await generateText({
      model: MODEL,
      system,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    })
    const text = (result.text ?? "").trim()
    if (!text) {
      throw new Error("empty generation")
    }
    return { text, model: currentModelName() }
  } catch (e) {
    if (e instanceof AppError) throw e
    logger.warn("marketing.studio.generator", "generateText failed", {
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("AI_UNAVAILABLE")
  }
}

function currentModelName(): string {
  return process.env.OPENROUTER_MODEL || process.env.OPENROUTER_FREE_MODEL || "openrouter/auto"
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}
