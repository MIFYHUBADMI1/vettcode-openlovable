"use client"

import { CREDIT_BLOCK_FRESH_MS, CREDIT_BLOCK_HEADER } from "@/lib/projects/credit-block"

/**
 * The credit gate.
 *
 * Every credit-consuming route answers the same way when a founder cannot
 * afford the work: HTTP 402 with `{ ok:false, error:{ code, message } }`. There
 * are three dozen of those call sites and they do not all share a helper — some
 * use `postJson`, plenty call `fetch` directly — so this module wraps `fetch`
 * once instead of asking every panel to remember to report a shortfall.
 *
 * On a 402 it does two things: it remembers the interrupted request (so paying
 * can resume it) and it publishes a signal the billing overlay listens for. The
 * original `Response` is returned untouched, so existing toasts and banners
 * keep working exactly as they do today.
 *
 * Streaming (ndjson) replies are not covered: routes that charge for a stream
 * check the balance before the first frame, so those refusals arrive as a plain
 * 402 through this same path.
 */

export const CREDIT_GATE_EVENT = "atai:credit-shortfall"
export const INSUFFICIENT_CREDIT_CODES: readonly string[] = [
  "INSUFFICIENT_CREDITS",
  "runtime_insufficient_entitlement",
]

const PENDING_KEY = "atai:pending-action"
/** Long enough to come back from a payment page, short enough that a stale
 * request is never replayed against a project the founder has since changed. */
export const PENDING_TTL_MS = 30 * 60 * 1000
const MAX_BODY_CHARS = 20_000
const REPLAYABLE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])
/** Never intercept our own money endpoints — a loop here would be endless. */
const SKIP_PATH = /^\/api\/billing\/(checkout|upgrade-options)(\?|$)/

export type ReplayMethod = "POST" | "PATCH" | "PUT" | "DELETE"

export interface ReplayableRequest {
  url: string
  method: ReplayMethod
  /** JSON or urlencoded text, re-sent verbatim. */
  body: string | null
  contentType: string | null
  /** Plain-text form fields, rebuilt into a FormData on replay. A form carrying
   * a file cannot be stashed in sessionStorage, so those stay report-only. */
  form: Array<[string, string]> | null
}

export interface CreditShortfall {
  code: string
  message: string | null
  required: number | null
  available: number | null
  /** Human name for what they were doing, e.g. "your build". */
  action: string
  at: number
  request: ReplayableRequest | null
  /** Set when a background run recorded the shortfall on its project instead
   * of refusing a live request. That flow has nothing to resume. */
  pipeline?: true
}

// ─── Pure parsing ─────────────────────────────────────────────────────────────

export function isInsufficientCreditsCode(code?: string | null): boolean {
  return typeof code === "string" && INSUFFICIENT_CREDIT_CODES.includes(code)
}

function firstNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    const raw = match?.[1]
    if (!raw) continue
    const value = Number(raw.replace(/[,_\s]/g, ""))
    if (Number.isFinite(value) && value > 0) return Math.round(value)
  }
  return null
}

/** Route messages vary in wording, so read the numbers out of the prose when a
 * route did not send structured `meta`. Never invents a figure: null means
 * "we do not know", and the overlay then says so instead of guessing. */
export function extractShortfallFacts(message: string): { required: number | null; available: number | null } {
  const required = firstNumber(message, [
    /required:?\s*([\d,_\s]*\d)/i,
    /you\s+need\s+([\d,_\s]*\d)\s*credits?/i,
    /needs?\s+([\d,_\s]*\d)\s*credits?/i,
    /requires?\s+([\d,_\s]*\d)\s*credits?/i,
    /costs?\s+([\d,_\s]*\d)\s*credits?/i,
    /\bneed\s+([\d,_\s]*\d)\b/i,
  ])
  const available = firstNumber(message, [
    /available:?\s*([\d,_\s]*\d)/i,
    /you\s+have\s+([\d,_\s]*\d)\s*(?:available|credits?)/i,
    /your\s+balance\s+is\s+([\d,_\s]*\d)/i,
  ])
  return { required, available }
}

const ACTION_LABELS: Array<[RegExp, string]> = [
  [/\/build(\?|$)/, "your build"],
  [/\/retry(\?|$)/, "the retry"],
  [/\/agent(\?|$)/, "your edit request"],
  [/\/deploy(\?|$)/, "launching your site"],
  [/\/fork(\?|$)/, "the fork"],
  [/\/plan-chat(\?|$)/, "your co-founder's reply"],
  [/\/auto-complete(\?|$)/, "the plan autocomplete"],
  [/\/analyze-plan(\?|$)/, "the plan analysis"],
  [/\/generate-visual(\?|$)/, "the visual mockup"],
  [/\/seo-audit(\?|$)/, "the SEO audit"],
  [/\/content-studio(\?|$)/, "the content studio"],
  [/\/studio\/(refine|variations)(\?|$)/, "the content studio"],
  [/\/market\/studio(\?|$)/, "the market studio"],
  [/\/resources\/(action-plan|market-research|competitors|marketing-playbook)(\?|$)/, "the resource report"],
  [/\/api\/runtime\//, "an AI call"],
]

export function describeAction(url: string): string {
  for (const [pattern, label] of ACTION_LABELS) {
    if (pattern.test(url)) return label
  }
  return "this"
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value)
  return null
}

export function parseCreditShortfall(
  body: unknown,
  request: ReplayableRequest | null,
  at = Date.now(),
): CreditShortfall | null {
  if (!body || typeof body !== "object") return null
  const envelope = body as { ok?: unknown; error?: { code?: unknown; message?: unknown; meta?: unknown } }
  if (envelope.ok !== false) return null
  const rawCode = envelope.error?.code
  if (typeof rawCode !== "string" || !isInsufficientCreditsCode(rawCode)) return null
  const code = rawCode

  const message = typeof envelope.error?.message === "string" ? envelope.error.message : null
  const facts = message ? extractShortfallFacts(message) : { required: null, available: null }
  const meta = (envelope.error?.meta ?? null) as { required?: unknown; available?: unknown } | null

  return {
    code,
    message,
    required: cleanNumber(meta?.required) ?? facts.required,
    available: cleanNumber(meta?.available) ?? facts.available,
    action: request ? describeAction(request.url) : "this",
    at,
    request,
  }
}

// ─── A background run's shortfall, carried on a normal response ───────────────

/** A project poll can flag that a background run stopped for lack of credits —
 * there was no request to refuse in that flow. Returns null for anything
 * malformed, not a shortfall, or too old to act on. */
export function parseCreditBlockHeader(
  value: string | null,
  now = Date.now(),
): CreditShortfall | null {
  if (!value) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(decodeURIComponent(value))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const raw = parsed as { required?: unknown; available?: unknown; action?: unknown; at?: unknown }
  const required = cleanNumber(raw.required)
  const available = cleanNumber(raw.available) ?? 0
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : null
  const action = typeof raw.action === "string" && raw.action.trim() ? raw.action.trim() : null
  if (required === null || at === null || action === null) return null
  if (required <= available) return null
  if (now - at > CREDIT_BLOCK_FRESH_MS) return null
  return {
    code: "INSUFFICIENT_CREDITS",
    message: null,
    required,
    available,
    action,
    at,
    request: null,
    pipeline: true,
  }
}

// ─── The interrupted request, kept across the payment redirect ────────────────

export function savePendingAction(shortfall: CreditShortfall): void {
  if (typeof window === "undefined" || !shortfall.request) return
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ v: 1, ...shortfall }))
  } catch {
    /* Private mode or a full quota: the overlay still opens, it just cannot resume. */
  }
}

function readPending(): CreditShortfall | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CreditShortfall> & { request?: ReplayableRequest }
    if (!parsed || typeof parsed.at !== "number" || !parsed.request) return null
    const stored = parsed.request
    if (!stored?.url?.startsWith("/") || !REPLAYABLE_METHODS.has(String(stored.method).toUpperCase())) {
      return null
    }
    return {
      code: typeof parsed.code === "string" ? parsed.code : "INSUFFICIENT_CREDITS",
      message: typeof parsed.message === "string" ? parsed.message : null,
      required: cleanNumber(parsed.required),
      available: cleanNumber(parsed.available),
      action: typeof parsed.action === "string" ? parsed.action : "this",
      at: parsed.at,
      request: {
        url: stored.url,
        method: String(stored.method).toUpperCase() as ReplayMethod,
        body: typeof stored.body === "string" ? stored.body : null,
        contentType: typeof stored.contentType === "string" ? stored.contentType : null,
        form: Array.isArray(stored.form)
          ? stored.form.filter(
              (entry): entry is [string, string] =>
                Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "string",
            )
          : null,
      },
    }
  } catch {
    return null
  }
}

/** The stored action, or null when nothing is waiting or it has gone stale. */
export function peekPendingAction(now = Date.now()): CreditShortfall | null {
  const pending = readPending()
  if (!pending) return null
  if (now - pending.at > PENDING_TTL_MS) {
    clearPendingAction()
    return null
  }
  return pending
}

/** Take it once: a replay must never fire twice for the same payment. */
export function takePendingAction(now = Date.now()): CreditShortfall | null {
  const pending = peekPendingAction(now)
  if (pending) clearPendingAction()
  return pending
}

export function clearPendingAction(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* nothing to clear */
  }
}

// ─── The payment handoff ──────────────────────────────────────────────────────

const HANDOFF_KEY = "atai:payment-handoff"

/** Set just before we leave for the payment page. Whether the payment provider
 * appends anything to our return URL is out of our hands, so the flag — not a
 * query parameter — is what tells a returning founder "finish the resume". */
export function markPaymentHandoff(at = Date.now()): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ at }))
  } catch {
    /* storage blocked: nothing to resume, nothing to mark */
  }
}

export function takePaymentHandoff(now = Date.now()): boolean {
  if (typeof window === "undefined") return false
  let stored: string | null = null
  try {
    stored = window.sessionStorage.getItem(HANDOFF_KEY)
    window.sessionStorage.removeItem(HANDOFF_KEY)
  } catch {
    return false
  }
  if (!stored) return false
  try {
    const parsed = JSON.parse(stored) as { at?: unknown }
    return typeof parsed.at === "number" && now - parsed.at <= PENDING_TTL_MS
  } catch {
    return false
  }
}

// ─── Signal bus ───────────────────────────────────────────────────────────────

export function publishCreditShortfall(shortfall: CreditShortfall): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<CreditShortfall>(CREDIT_GATE_EVENT, { detail: shortfall }))
}

export function subscribeToCreditGate(handler: (shortfall: CreditShortfall) => void): () => void {
  if (typeof window === "undefined") return () => undefined
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<CreditShortfall>).detail
    if (detail && typeof detail.at === "number") handler(detail)
  }
  window.addEventListener(CREDIT_GATE_EVENT, listener)
  return () => window.removeEventListener(CREDIT_GATE_EVENT, listener)
}

// ─── The fetch wrapper ────────────────────────────────────────────────────────

function sameOriginPath(input: RequestInfo | URL): string | null {
  if (typeof input === "string") {
    if (input.startsWith("/")) return input
    if (/^[a-z]+:\/\//i.test(input)) {
      if (typeof window === "undefined") return null
      try {
        const url = new URL(input)
        return url.origin === window.location.origin ? `${url.pathname}${url.search}` : null
      } catch {
        return null
      }
    }
    return null
  }
  if (input instanceof URL) {
    if (typeof window === "undefined") return null
    return input.origin === window.location.origin ? `${input.pathname}${input.search}` : null
  }
  return sameOriginPath(input.url)
}

function contentTypeOf(init: RequestInit | undefined): string | null {
  const headers = init?.headers
  if (!headers) return null
  if (typeof Headers !== "undefined" && headers instanceof Headers) return headers.get("content-type")
  if (Array.isArray(headers)) {
    const found = headers.find(([name]) => name?.toLowerCase() === "content-type")
    return found?.[1] ?? null
  }
  const record = headers as Record<string, string>
  for (const name of Object.keys(record)) {
    if (name.toLowerCase() === "content-type") return record[name]
  }
  return null
}

/**
 * Snapshot a request so it can be re-sent after a payment.
 *
 * Returns null when the body cannot be reproduced: an upload, a stream, or a
 * `Request` whose body was already consumed. Those shortfalls are still
 * reported, the overlay just promises "run it again" instead of "resumed".
 */
export function captureRequest(input: RequestInfo | URL, init?: RequestInit): ReplayableRequest | null {
  const path = sameOriginPath(input)
  if (!path || SKIP_PATH.test(path)) return null

  const method = String(
    init?.method ?? (typeof input === "object" && !(input instanceof URL) ? input.method : "GET"),
  ).toUpperCase()
  if (!REPLAYABLE_METHODS.has(method)) return null
  const replayMethod = method as ReplayMethod

  const raw = init?.body
  if (raw === undefined || raw === null) {
    // A `Request` object can carry its own body, which is a stream we cannot
    // re-read after it has been sent.
    if (typeof input === "object" && !(input instanceof URL) && input.body != null) return null
    return { url: path, method: replayMethod, body: null, contentType: contentTypeOf(init), form: null }
  }

  if (typeof raw === "string") {
    if (raw.length > MAX_BODY_CHARS) return null
    return { url: path, method: replayMethod, body: raw, contentType: contentTypeOf(init), form: null }
  }

  if (raw instanceof URLSearchParams) {
    const text = raw.toString()
    if (text.length > MAX_BODY_CHARS) return null
    return {
      url: path,
      method: replayMethod,
      body: text,
      contentType: "application/x-www-form-urlencoded;charset=UTF-8",
      form: null,
    }
  }

  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    const fields: Array<[string, string]> = []
    for (const [name, value] of raw.entries()) {
      if (typeof value !== "string") return null // a file: not storable, not replayable
      fields.push([name, value])
    }
    if (JSON.stringify(fields).length > MAX_BODY_CHARS) return null
    return { url: path, method: replayMethod, body: null, contentType: null, form: fields }
  }

  return null
}

type WindowWithGate = Window & { __ataiCreditGate?: boolean }

/** A blocked run is polled on a timer, so the same shortfall arrives over and
 * over. Offer it once — the founder can always get it again by retrying. */
const seenPipelineBlocks = new Set<string>()

function notePipelineBlock(key: string): boolean {
  if (seenPipelineBlocks.has(key)) return false
  if (seenPipelineBlocks.size > 60) seenPipelineBlocks.clear()
  seenPipelineBlocks.add(key)
  return true
}

/** Idempotent: hot reloads and repeated provider mounts must not stack wraps. */
export function installCreditGateInterceptor(): void {
  if (typeof window === "undefined") return
  const target = window as WindowWithGate
  if (target.__ataiCreditGate) return
  target.__ataiCreditGate = true

  const nativeFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await nativeFetch(input as RequestInfo, init)

    if (response.status === 402) {
      try {
        const request = captureRequest(input, init)
        const clone = await response.clone().json().catch(() => null)
        const shortfall = parseCreditShortfall(clone, request)
        if (shortfall) {
          savePendingAction(shortfall)
          publishCreditShortfall(shortfall)
        }
      } catch {
        /* Diagnostics must never break the caller's own error handling. */
      }
      return response
    }

    // A background run that could not afford its next step flags it here.
    try {
      const header = response.headers.get(CREDIT_BLOCK_HEADER)
      if (header) {
        const path = sameOriginPath(input)
        const shortfall = parseCreditBlockHeader(header)
        if (path && shortfall && notePipelineBlock(`${path}:${shortfall.at}`)) {
          publishCreditShortfall(shortfall)
        }
      }
    } catch {
      /* same rule as above */
    }
    return response
  }
}

/** Re-send the request the founder was making. Throws like any API helper when
 * it fails again, so the caller can fall back to the overlay. */
export async function replayPendingAction(pending: CreditShortfall): Promise<unknown> {
  const request = pending.request
  if (!request) throw new Error("Nothing to resume.")

  const headers: Record<string, string> = { accept: "application/json" }
  let body: BodyInit | undefined
  if (request.form && request.form.length > 0) {
    const form = new FormData()
    for (const [name, value] of request.form) form.append(name, value)
    // No content-type here: the browser must set the multipart boundary itself.
    body = form
  } else if (request.body !== null) {
    headers["content-type"] = request.contentType ?? "application/json"
    body = request.body
  }

  const res = await fetch(request.url, { method: request.method, credentials: "include", headers, body })
  const payload = (await res.json().catch(() => null)) as
    | { ok?: boolean; error?: { code?: string; message?: string; meta?: unknown } }
    | null
  if (payload && payload.ok === false) {
    const err = new Error(payload.error?.message ?? "Could not resume your action.") as Error & {
      code?: string
      meta?: { required?: number; available?: number } | null
    }
    err.code = payload.error?.code
    err.meta = (payload.error?.meta as { required?: number; available?: number } | null) ?? null
    throw err
  }
  return payload && "data" in payload ? (payload as { data: unknown }).data : null
}
