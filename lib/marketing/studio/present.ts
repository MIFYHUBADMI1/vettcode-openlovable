import "server-only"

/**
 * Shared client-safe projection of a stored content item. Used by every studio
 * API so the UI never depends on Mongo internals (`_id`, raw media blobs).
 * Media is reduced to a flag plus a bounded data URL.
 */

import type { ContentItemDoc, MarketAssetKind } from "@/lib/types/db"

const TEMPLATE_KIND: Record<string, MarketAssetKind> = {
  landing_hero: "copy",
  feature_blurb: "copy",
  ad_headline: "copy",
  email_welcome: "email",
  market_studio: "copy",
}

export interface ContentItemView {
  id: string
  /** Display kind — the asset kind when present, else the template's family. */
  kind: MarketAssetKind
  template: string
  title: string
  body: string
  version: number
  status: ContentItemDoc["status"]
  origin: ContentItemDoc["origin"]
  creditsCharged: number
  channel?: string
  tags?: string[]
  plannedAt?: number
  variantOf?: string
  model?: string
  media?: { kind: "image" | "audio" | "video"; dataUrl?: string; jobId?: string; status?: string; notPersisted?: boolean }
  createdAt: number
  updatedAt: number
}

export function contentKind(doc: ContentItemDoc): MarketAssetKind {
  return doc.assetKind ?? TEMPLATE_KIND[doc.template] ?? "copy"
}

export function presentContentItem(doc: ContentItemDoc): ContentItemView {
  const media = doc.media
    ? {
        kind: doc.media.kind,
        ...(doc.media.dataUrl ? { dataUrl: doc.media.dataUrl } : {}),
        ...(doc.media.jobId ? { jobId: doc.media.jobId } : {}),
        ...(doc.media.status ? { status: doc.media.status } : {}),
        ...(doc.media.notPersisted ? { notPersisted: true } : {}),
      }
    : undefined

  return {
    id: doc.id,
    kind: contentKind(doc),
    template: doc.template,
    title: doc.title,
    body: doc.body,
    version: doc.version,
    status: doc.status,
    origin: doc.origin,
    creditsCharged: doc.creditsCharged,
    ...(doc.channel ? { channel: doc.channel } : {}),
    ...(doc.tags ? { tags: doc.tags } : {}),
    ...(doc.plannedAt ? { plannedAt: doc.plannedAt } : {}),
    ...(doc.variantOf ? { variantOf: doc.variantOf } : {}),
    ...(doc.model ? { model: doc.model } : {}),
    ...(media ? { media } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}
