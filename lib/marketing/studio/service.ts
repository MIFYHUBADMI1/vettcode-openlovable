import "server-only"

/**
 * Marketing Studio service (Phase 4 — W3).
 *
 * Orchestrates draft generation and hand-editing on top of `content_items`.
 * Like `runSeoAudit`, it does NOT charge credits (that is the caller's concern
 * via `chargeStudioCredits`); it reads the project, derives brand voice from the
 * plan, runs one bounded generation, and persists an AI-generated draft.
 * Editing saves an IMMUTABLE new version (never overwrites) — there is no
 * publish/scheduling action anywhere in this module, by design (deferred to the
 * W4/W5 job substrate).
 */

import { ObjectId } from "mongodb"
import { store } from "@/lib/store/store"
import { contentItemsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import { generateCopy, deriveBrandVoice, studioTemplateLabel, isStudioTemplate } from "./generator"
import type { ContentItemDoc, StudioTemplate } from "@/lib/types/db"

export interface StudioDraftOutcome {
  contentId: string
  projectId: string
  template: StudioTemplate
  title: string
  body: string
  version: number
  model: string
  brandVoiceSources: string[]
}

/** Generate one draft and persist it (v1). Does not charge. */
export async function generateMarketingDraft(input: {
  userId: string
  projectId: string
  template: string
  brief?: string
}): Promise<StudioDraftOutcome> {
  if (!isStudioTemplate(input.template)) {
    throw new AppError("VALIDATION")
  }
  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    // Fail closed — the caller's ownership gate should have prevented this.
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }
  const { voice, sources } = deriveBrandVoice(project.specification)
  const { text, model } = await generateCopy({
    template: input.template,
    projectName: project.name,
    brandVoice: voice,
    ...(input.brief ? { brief: input.brief } : {}),
  })

  const now = Date.now()
  const id = `content_${cryptoId()}`
  const title = `${studioTemplateLabel(input.template)} for ${project.name}`
  const doc: ContentItemDoc = {
    _id: new ObjectId(),
    id,
    userId: input.userId,
    projectId: input.projectId,
    kind: "marketing_copy",
    template: input.template,
    status: "draft",
    title,
    body: text,
    version: 1,
    origin: "ai_generated_marketing_content",
    model,
    creditsCharged: 0,
    createdAt: now,
    updatedAt: now,
  }

  await insertContentItem(doc, input.projectId)
  logger.info("marketing.studio", "draft generated", { projectId: input.projectId, contentId: id, template: input.template })
  return { contentId: id, projectId: input.projectId, template: input.template, title, body: text, version: 1, model, brandVoiceSources: sources }
}

/**
 * Save a hand-edited version. FREE (no credits) and NON-destructive: it appends a
 * new immutable version chained to the original via `parentContentId` rather than
 * overwriting. Explicitly refuses to touch publish state (no such field exists).
 */
export async function reviseContentItem(input: {
  userId: string
  projectId: string
  contentId: string
  body: string
  title?: string
}): Promise<ContentItemDoc> {
  const col = await contentItemsCol()
  const parent = await col.findOne({ id: input.contentId, projectId: input.projectId }) as unknown as ContentItemDoc | null
  if (!parent || parent.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }
  const body = (input.body ?? "").trim()
  if (!body) throw new AppError("VALIDATION")

  const now = Date.now()
  const id = `content_${cryptoId()}`
  const doc: ContentItemDoc = {
    _id: new ObjectId(),
    id,
    userId: input.userId,
    projectId: input.projectId,
    kind: "marketing_copy",
    template: parent.template,
    status: "draft",
    title: (input.title ?? "").trim() || parent.title,
    body,
    version: parent.version + 1,
    parentContentId: parent.parentContentId ?? parent.id,
    origin: "ai_generated_marketing_content",
    creditsCharged: 0,
    createdAt: now,
    updatedAt: now,
  }
  await insertContentItem(doc, input.projectId)
  logger.info("marketing.studio", "draft revised", { projectId: input.projectId, contentId: id, version: doc.version })
  return doc
}

/** Latest content items for a project (ownership-scoped by caller). Read-only, free. */
export async function listContentItems(projectId: string, limit = 50): Promise<ContentItemDoc[]> {
  const col = await contentItemsCol()
  return (await col.find({ projectId }).sort({ updatedAt: -1 }).limit(limit).toArray()) as unknown as ContentItemDoc[]
}

async function insertContentItem(doc: ContentItemDoc, projectId: string): Promise<void> {
  try {
    const col = await contentItemsCol()
    await col.insertOne(doc as never)
  } catch (e) {
    logger.error("marketing.studio", "failed to persist content item", {
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("DATABASE_UNAVAILABLE")
  }
}
