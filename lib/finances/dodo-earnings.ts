import "server-only"
import { logger } from "@/lib/logging/logger"
import { ATTRIBUTION_METADATA_KEYS } from "@/lib/runtime/router/adapters/dodo/adapter"
import {
  dodoHeaders,
  getDodoApiKey,
  getDodoBaseUrl,
  getDodoTimeoutMs,
} from "@/lib/runtime/router/adapters/dodo/config"

/**
 * Atai Finance — project-attributed Dodo earnings sync (server-only).
 *
 * The runtime stamps trusted attribution metadata (`_ataiProjectId`,
 * `_ataiApiKeyId`, `_ataiEnvironment`) onto every checkout/subscription it
 * creates (see the Dodo adapter). This module reads the platform's Dodo
 * PAYMENT FEED server-side, keeps only payments attributed to the requested
 * project, and exposes a bounded, cached, honest result:
 *
 *  - "unavailable" — the platform's Dodo credential is not configured;
 *    the dashboard shows a setup-needed state, never fabricated zeros.
 *  - "ok"          — payments were read from the provider feed.
 *  - "error"       — the provider refused/faulted (bounded single attempt);
 *    cached failures decay quickly so the page recovers.
 *
 * The sync NEVER writes anything and never exposes raw wire formats beyond
 * the normalized subset below.
 *
 * @module lib/finances/dodo-earnings
 */

/** How much provider history a single sync may pull: 3 pages × 100 items. */
const MAX_PAGES = 3
const PAGE_SIZE = 100
/** Provider feed cache per project — keeps dashboard loads off Dodo's API. */
const CACHE_TTL_MS = 5 * 60 * 1000
const ERROR_TTL_MS = 30 * 1000
const MAX_CACHE_ENTRIES = 500

export interface ProjectPayment {
  paymentId: string
  /** Gross amount in minor units (as Dodo reports it), null when missing. */
  amountMinor: number | null
  currency: string | null
  status: string
  /** Epoch-ms createdAt; null when the provider omits it. */
  createdAt: number | null
  /** Set for recurring/subscription payments. */
  subscriptionId: string | null
  customerEmail: string | null
  checkoutId: string | null
}

export type EarningsResult =
  | { status: "ok"; payments: ProjectPayment[]; fetchedAt: number; pages: number }
  | { status: "unavailable"; payments: []; fetchedAt: null; note: string }
  | { status: "error"; payments: []; fetchedAt: null; note: string }

const cache = new Map<string, { at: number; value: EarningsResult }>()

/**
 * Synchronized read of the project's attributed payments (cached). Bounded to
 * three provider pages — very high-volume projects page deeper through the
 * runtime `payments/listPayments` capability instead.
 */
export async function getProjectEarnings(projectId: string, sinceMs: number): Promise<EarningsResult> {
  const existing = cache.get(projectId)
  const ttl = existing?.value.status === "ok" ? CACHE_TTL_MS : ERROR_TTL_MS
  if (existing && Date.now() - existing.at < ttl) {
    return existing.value
  }

  let result: EarningsResult
  try {
    getDodoApiKey() // throws ProviderNotConfiguredError when unset
    result = await fetchProjectPayments(projectId, sinceMs)
  } catch (e) {
    if (e instanceof Error && e.name === "ProviderNotConfiguredError") {
      result = {
        status: "unavailable",
        payments: [],
        fetchedAt: null,
        note: "The platform payment provider is not configured on this deployment (missing DODO_PAYMENTS_API_KEY).",
      }
    } else {
      logger.warn("runtime.finance", "earnings sync failed", {
        projectId,
        message: e instanceof Error ? e.message : String(e),
      })
      result = {
        status: "error",
        payments: [],
        fetchedAt: null,
        note: "The payment provider could not be reached for this project's earnings. Retrying shortly.",
      }
    }
  }

  // Cheap bounded cache (no unbounded growth).
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(projectId, { at: Date.now(), value: result })
  return result
}

/** Test seam: clear all cached earnings (per-worker isolation). */
export function clearEarningsCache(): void {
  cache.clear()
}

async function fetchProjectPayments(projectId: string, sinceMs: number): Promise<EarningsResult> {
  const base = getDodoBaseUrl()
  const timeoutMs = getDodoTimeoutMs()
  const headers = dodoHeaders()
  const startedAtGte = new Date(sinceMs).toISOString()

  const collected: ProjectPayment[] = []
  let pages = 0
  for (let page = 1; page <= MAX_PAGES; page++) {
    const search = new URLSearchParams({
      page_number: String(page),
      page_size: String(PAGE_SIZE),
      created_at_gte: startedAtGte,
    })
    const res = await fetch(`${base}/payments?${search.toString()}`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) {
      throw new Error(`payment provider returned ${res.status}`)
    }
    const body = (await res.json().catch(() => null)) as { items?: unknown[] } | null
    const items = Array.isArray(body?.items) ? body.items : []
    pages = page
    if (items.length === 0) break
    collected.push(...filterProjectPayments(items, projectId))
    if (items.length < PAGE_SIZE) break
  }

  return { status: "ok", payments: collected, fetchedAt: Date.now(), pages }
}

/**
 * Pure filter per the attribution contract: only payments whose metadata
 * carries THIS project's id are kept — anything else (other projects,
 * platform billing, untagged traffic) stays out of a project's finance view.
 */
export function filterProjectPayments(items: unknown[], projectId: string): ProjectPayment[] {
  const out: ProjectPayment[] = []
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue
    const p = item as Record<string, unknown>
    const metadata = (p.metadata ?? {}) as Record<string, unknown>
    if (metadata[ATTRIBUTION_METADATA_KEYS.projectId] !== projectId) continue

    const paymentId = p.payment_id
    if (typeof paymentId !== "string" || !paymentId) continue

    const createdAtIso = typeof p.created_at === "string" ? p.created_at : null
    const createdAt = createdAtIso ? Date.parse(createdAtIso) : NaN

    out.push({
      paymentId,
      amountMinor:
        typeof p.total_amount === "number" && Number.isFinite(p.total_amount) ? p.total_amount : null,
      currency: typeof p.currency === "string" ? p.currency : null,
      status: typeof p.status === "string" ? p.status : "unknown",
      createdAt: Number.isFinite(createdAt) ? createdAt : null,
      subscriptionId: typeof p.subscription_id === "string" ? p.subscription_id : null,
      customerEmail:
        (p.customer as { email?: unknown } | undefined)?.email && typeof (p.customer as { email: unknown }).email === "string"
          ? (p.customer as { email: string }).email
          : null,
      checkoutId:
        typeof (p.checkout as { id?: unknown } | undefined)?.id === "string"
          ? (p.checkout as { id: string }).id
          : null,
    })
  }
  return out
}
