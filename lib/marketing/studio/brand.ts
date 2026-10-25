import "server-only"

/**
 * Brand profile service (Phase 4 v2).
 *
 * ONE persisted profile per project — founder-authored PREFERENCES (tone,
 * audience, vocabulary, claims to avoid), never measured facts. It grounds
 * every generation and is reused across requests instead of re-asking.
 *
 * Ownership: every write re-checks `project.userId` against the caller. Reads
 * are scoped by the route's verified project id. Nothing here is embedded in
 * `projects`, and nothing here is exposed across projects.
 */

import { ObjectId } from "mongodb"
import { brandProfilesCol } from "@/lib/db/collections"
import { cryptoId, store } from "@/lib/store/store"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type { BrandProfileDoc } from "@/lib/types/db"

export const BRAND_MAX_SHORT = 200
export const BRAND_MAX_LONG = 1200
export const BRAND_MAX_LIST = 12
export const BRAND_MAX_ITEM = 60

export interface BrandProfileInput {
  brandName?: string | null
  description?: string | null
  tone?: string | null
  audience?: string | null
  valueProposition?: string | null
  differentiators?: string[] | null
  vocabulary?: string[] | null
  avoid?: string[] | null
  callToAction?: string | null
}

const SHORT_FIELDS = ["brandName", "tone", "audience", "callToAction"] as const
const LONG_FIELDS = ["description", "valueProposition"] as const
const LIST_FIELDS = ["differentiators", "vocabulary", "avoid"] as const

function cleanText(value: string | null | undefined, max: number): string | null {
  const trimmed = (value ?? "").trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function cleanList(value: string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null
  const out = [...new Set(value.map((v) => (v ?? "").trim()).filter(Boolean))].slice(0, BRAND_MAX_LIST)
  return out.length ? out.map((v) => v.slice(0, BRAND_MAX_ITEM)) : null
}

export async function getBrandProfile(projectId: string): Promise<BrandProfileDoc | null> {
  const col = await brandProfilesCol()
  const doc = await col.findOne({ projectId })
  return (doc as unknown as BrandProfileDoc) ?? null
}

/**
 * Create or replace the project's brand profile. Fields set to null/"" are
 * removed, so a founder can genuinely clear a preference — an empty value never
 * silently keeps the old one.
 */
export async function saveBrandProfile(
  input: { userId: string; projectId: string } & BrandProfileInput,
): Promise<BrandProfileDoc> {
  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    // Fail closed — the caller's ownership gate should have caught this.
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const now = Date.now()
  const set: Record<string, unknown> = { updatedAt: now }
  const unset: Record<string, 1> = {}

  for (const field of SHORT_FIELDS) {
    const value = cleanText(input[field], BRAND_MAX_SHORT)
    if (value === null) unset[field] = 1
    else set[field] = value
  }
  for (const field of LONG_FIELDS) {
    const value = cleanText(input[field], BRAND_MAX_LONG)
    if (value === null) unset[field] = 1
    else set[field] = value
  }
  for (const field of LIST_FIELDS) {
    const value = cleanList(input[field])
    if (value === null) unset[field] = 1
    else set[field] = value
  }

  const col = await brandProfilesCol()
  const update: Record<string, unknown> = {
    $set: set,
    $setOnInsert: {
      _id: new ObjectId(),
      id: `brand_${cryptoId()}`,
      userId: input.userId,
      projectId: input.projectId,
      createdAt: now,
    },
  }
  if (Object.keys(unset).length > 0) update.$unset = unset

  try {
    await col.updateOne({ projectId: input.projectId }, update, { upsert: true })
  } catch (e) {
    logger.error("marketing.studio.brand", "failed to save brand profile", {
      projectId: input.projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("DATABASE_UNAVAILABLE")
  }

  const saved = await getBrandProfile(input.projectId)
  if (!saved) throw new AppError("DATABASE_UNAVAILABLE")
  logger.info("marketing.studio.brand", "brand profile saved", { projectId: input.projectId })
  return saved
}

/**
 * Compact, bounded preference block for a generation prompt. Returns which
 * fields contributed so the UI can say the voice came from the founder's own
 * settings rather than an inferred persona.
 */
export function brandContextLines(profile: BrandProfileDoc | null): { lines: string[]; sources: string[] } {
  const lines: string[] = []
  const sources: string[] = []
  if (!profile) return { lines, sources }

  const add = (label: string, value?: string) => {
    const v = (value ?? "").trim()
    if (!v) return
    lines.push(`${label}: ${v}`)
    sources.push(label)
  }
  add("Brand name", profile.brandName)
  add("Short description", profile.description)
  add("Preferred tone", profile.tone)
  add("Audience", profile.audience)
  add("Value proposition", profile.valueProposition)
  add("Preferred call to action", profile.callToAction)
  if (profile.differentiators?.length) {
    lines.push(`Differentiators: ${profile.differentiators.join("; ")}`)
    sources.push("Differentiators")
  }
  if (profile.vocabulary?.length) {
    lines.push(`Words to favour: ${profile.vocabulary.join(", ")}`)
    sources.push("Vocabulary")
  }
  if (profile.avoid?.length) {
    lines.push(`Words/claims to avoid: ${profile.avoid.join(", ")}`)
    sources.push("Claims to avoid")
  }
  return { lines, sources }
}
