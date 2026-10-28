"use client"

import { CREDIT_BLOCK_FRESH_MS, CREDIT_BLOCK_HEADER, sanitizeCreditBlock } from "@/lib/projects/credit-block"
import { deleteCreditRequestBody, readCreditRequestBody, saveCreditRequestBody } from "./credit-request-storage"

export const CREDIT_GATE_EVENT = "atai:credit-shortfall"
export const INSUFFICIENT_CREDIT_CODES: readonly string[] = ["INSUFFICIENT_CREDITS", "runtime_insufficient_entitlement"]
export const PENDING_TTL_MS = 30 * 60 * 1000
const PENDING_KEY = "atai:pending-action"
const HANDOFF_KEY = "atai:payment-handoff"
const MAX_BODY_CHARS = 20_000
const REPLAYABLE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])
const SKIP_PATH = /^\/api\/(billing|auth)(\/|\?|$)/
type CreditGateWindow = Window & { __ataiCreditGate?: boolean; __ataiCreditGateFetch?: typeof fetch }

export type ReplayMethod = "POST" | "PATCH" | "PUT" | "DELETE"
export interface ReplayableRequest {
  url: string
  method: ReplayMethod
  body: string | null
  contentType: string | null
  form: Array<[string, string]> | null
  bodyId?: string
  headers?: Record<string, string>
}
export interface CreditShortfall {
  code: string
  message: string | null
  required: number | null
  available: number | null
  action: string
  at: number
  request: ReplayableRequest | null
  pipeline?: true
  userId?: string
}

export function isInsufficientCreditsCode(code?: string | null): boolean {
  return typeof code === "string" && INSUFFICIENT_CREDIT_CODES.includes(code)
}
function cleanNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null
}
function firstNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const raw = pattern.exec(text)?.[1]
    if (!raw) continue
    const value = Number(raw.replace(/[,_\s]/g, ""))
    if (Number.isFinite(value) && value >= 0) return Math.round(value)
  }
  return null
}
export function extractShortfallFacts(message: string): { required: number | null; available: number | null } {
  return {
    required: firstNumber(message, [
      /required:?\s*([\d,_\s]*\d)/i,
      /you\s+need\s+([\d,_\s]*\d)\s*credits?/i,
      /needs?\s+([\d,_\s]*\d)\s*credits?/i,
      /requires?\s+([\d,_\s]*\d)\s*credits?/i,
      /costs?\s+([\d,_\s]*\d)\s*credits?/i,
      /\bneed\s+([\d,_\s]*\d)\b/i,
    ]),
    available: firstNumber(message, [
      /available:?\s*([\d,_\s]*\d)/i,
      /you\s+have\s+([\d,_\s]*\d)\s*(?:available|credits?)/i,
      /your\s+balance\s+is\s*([\d,_\s]*\d)/i,
    ]),
  }
}
const ACTION_LABELS: Array<[RegExp, string]> = [
  [/\/(build|launch)(\?|$)/, "your build"],
  [/\/retry(\?|$)/, "the retry"],
  [/\/agent(\?|$)/, "your edit request"],
  [/\/deploy(\?|$)/, "launching your site"],
  [/\/fork(\?|$)/, "the fork"],
  [/\/plan-chat(\?|$)/, "your co-founder's reply"],
  [/\/auto-complete(\?|$)/, "the plan autocomplete"],
  [/\/analyze-plan(\?|$)/, "the plan analysis"],
  [/\/generate-visual(\?|$)/, "the visual mockup"],
  [/\/seo-audit(\?|$)/, "the SEO audit"],
  [/\/(content-studio|market\/studio|studio\/(refine|variations))(\?|$)/, "the content studio"],
  [/\/resources\/(action-plan|market-research|competitors|marketing-playbook)(\?|$)/, "the resource report"],
  [/\/api\/runtime\//, "an AI call"],
]
export function describeAction(url: string): string {
  return ACTION_LABELS.find(([pattern]) => pattern.test(url))?.[1] ?? "this"
}
export function parseCreditShortfall(body: unknown, request: ReplayableRequest | null, at = Date.now()): CreditShortfall | null {
  if (!body || typeof body !== "object") return null
  const envelope = body as { ok?: unknown; error?: { code?: unknown; message?: unknown; meta?: { required?: unknown; available?: unknown } } }
  const code = envelope.error?.code
  if (envelope.ok !== false || typeof code !== "string" || !isInsufficientCreditsCode(code)) return null
  const message = typeof envelope.error?.message === "string" ? envelope.error.message : null
  const facts = message ? extractShortfallFacts(message) : { required: null, available: null }
  return {
    code, message,
    required: cleanNumber(envelope.error?.meta?.required) ?? facts.required,
    available: cleanNumber(envelope.error?.meta?.available) ?? facts.available,
    action: request ? describeAction(request.url) : "this", at, request,
  }
}
export function parseCreditBlockHeader(value: string | null, now = Date.now(), projectPath?: string): CreditShortfall | null {
  if (!value) return null
  let raw: unknown
  try { raw = JSON.parse(decodeURIComponent(value)) } catch { return null }
  const block = sanitizeCreditBlock(raw)
  if (!block || block.at > now || now - block.at > CREDIT_BLOCK_FRESH_MS) return null
  const project = projectPath?.match(/^\/api\/projects\/([A-Za-z0-9_-]+)(?:\?.*)?$/)
  const resume = block.resume ?? (block.action === "your build" ? "build" : "analysis")
  return {
    code: "INSUFFICIENT_CREDITS", message: null, ...block, pipeline: true,
    request: project ? {
      url: `/api/projects/${project[1]}/${resume === "build" ? "launch" : "retry"}`,
      method: "POST", body: "{}", contentType: "application/json", form: null,
    } : null,
  }
}

function sameOriginPath(input: RequestInfo | URL): string | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  if (raw.startsWith("//") || raw.includes("\\")) return null
  try {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin
    const url = new URL(raw, origin)
    if (url.origin !== origin || !url.pathname.startsWith("/api/") || SKIP_PATH.test(url.pathname)) return null
    return `${url.pathname}${url.search}`
  } catch { return null }
}
function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  return new Headers(init?.headers ?? (typeof input === "object" && !(input instanceof URL) ? input.headers : undefined))
}
function replayHeaders(headers: Headers): Record<string, string> | undefined {
  const preserved: Record<string, string> = {}
  for (const name of ["accept", "idempotency-key"]) {
    const value = headers.get(name)
    if (value) preserved[name] = value
  }
  return Object.keys(preserved).length ? preserved : undefined
}
export function captureRequest(input: RequestInfo | URL, init?: RequestInit): ReplayableRequest | null {
  const url = sameOriginPath(input)
  const method = String(init?.method ?? (typeof input === "object" && !(input instanceof URL) ? input.method : "GET")).toUpperCase()
  if (!url || !REPLAYABLE_METHODS.has(method)) return null
  const headers = requestHeaders(input, init)
  if (headers.has("authorization")) return null
  const base: ReplayableRequest = { url, method: method as ReplayMethod, body: null, contentType: headers.get("content-type"), form: null }
  const preserved = replayHeaders(headers)
  if (preserved) base.headers = preserved
  const raw = init?.body
  if (raw == null) {
    if (typeof input === "object" && !(input instanceof URL) && input.body !== null) return null
    return base
  }
  if (typeof raw === "string" && raw.length <= MAX_BODY_CHARS) return { ...base, body: raw }
  if (raw instanceof URLSearchParams && raw.toString().length <= MAX_BODY_CHARS) {
    return { ...base, body: raw.toString(), contentType: headers.get("content-type") ?? "application/x-www-form-urlencoded;charset=UTF-8" }
  }
  if (raw instanceof FormData) {
    const form: Array<[string, string]> = []
    for (const [name, value] of raw.entries()) {
      if (typeof value !== "string") return null
      form.push([name, value])
    }
    if (JSON.stringify(form).length <= MAX_BODY_CHARS) return { ...base, contentType: null, form }
  }
  return null
}

export function savePendingAction(shortfall: CreditShortfall): boolean {
  if (typeof window === "undefined" || !shortfall.request) return false
  try {
    const previous = peekPendingAction()
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(shortfall))
    if (previous?.request?.bodyId && previous.request.bodyId !== shortfall.request.bodyId) {
      void deleteCreditRequestBody(previous.request.bodyId).catch(() => {})
    }
    return true
  } catch { return false }
}
export function peekPendingAction(now = Date.now()): CreditShortfall | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CreditShortfall
    const request = parsed?.request
    if (!request || typeof parsed.at !== "number" || !Number.isFinite(parsed.at) || !REPLAYABLE_METHODS.has(request.method)) return null
    if (typeof request.url !== "string" || sameOriginPath(request.url) !== request.url) return null
    if (now - parsed.at > PENDING_TTL_MS || parsed.at > now) {
      clearPendingAction()
      return null
    }
    return parsed
  } catch { return null }
}
export function clearPendingAction(): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY)
    window.sessionStorage.removeItem(PENDING_KEY)
    const bodyId = raw ? (JSON.parse(raw) as CreditShortfall).request?.bodyId : undefined
    if (bodyId) void deleteCreditRequestBody(bodyId).catch(() => {})
  } catch { /* Storage may be disabled. */ }
}
export function markPaymentHandoff(at = Date.now()): void {
  if (typeof window !== "undefined") window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ at }))
}
export function clearPaymentHandoff(): void {
  if (typeof window === "undefined") return
  try { window.sessionStorage.removeItem(HANDOFF_KEY) } catch { /* Storage may be disabled. */ }
}
export function hasPaymentHandoff(now = Date.now()): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY)
    if (!raw) return false
    const at = (JSON.parse(raw) as { at?: unknown }).at
    if (typeof at === "number" && at <= now && now - at <= PENDING_TTL_MS) return true
    clearPaymentHandoff()
  } catch { /* Storage may be disabled. */ }
  return false
}
export function publishCreditShortfall(shortfall: CreditShortfall): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<CreditShortfall>(CREDIT_GATE_EVENT, { detail: shortfall }))
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

export function installCreditGateInterceptor(): void {
  if (typeof window === "undefined") return
  const target = window as CreditGateWindow
  if (target.__ataiCreditGate) return
  target.__ataiCreditGate = true
  const nativeFetch = window.fetch.bind(window)
  target.__ataiCreditGateFetch = nativeFetch
  const seenBlocks = new Set<string>()
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = sameOriginPath(input)
    let outgoing: Request | null = null
    let snapshot: Promise<{ request: ReplayableRequest; body: Blob } | null> | null = null
    const basic = captureRequest(input, init)
    const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
    if (path && !basic && REPLAYABLE_METHODS.has(method) && !requestHeaders(input, init).has("authorization")) {
      try {
        outgoing = new Request(input instanceof Request ? input : new URL(path, window.location.origin), init)
        const clone = outgoing.clone()
        snapshot = clone.blob().then((body) => ({
          body,
          request: { url: path, method: method as ReplayMethod, body: null, contentType: clone.headers.get("content-type"), form: null, headers: replayHeaders(clone.headers) },
        })).catch(() => null)
      } catch { /* A consumed request cannot be replayed. */ }
    }
    const response = outgoing ? await nativeFetch(outgoing) : await nativeFetch(input, init)
    if (!path) return response
    try {
      if (response.status === 402) {
        const payload: unknown = await response.clone().json().catch(() => null)
        let request = basic
        const captured = snapshot ? await snapshot : null
        if (captured) {
          try {
            request = { ...captured.request, bodyId: await saveCreditRequestBody(captured.body, Date.now() + PENDING_TTL_MS) }
          } catch { request = null }
        }
        const shortfall = parseCreditShortfall(payload, request)
        if (shortfall) {
          if (!request || !savePendingAction(shortfall)) {
            clearPendingAction()
            shortfall.request = null
          }
          publishCreditShortfall(shortfall)
        }
      } else {
        const shortfall = parseCreditBlockHeader(response.headers.get(CREDIT_BLOCK_HEADER), Date.now(), path)
        const key = shortfall ? `${path}:${shortfall.at}` : ""
        if (shortfall && !seenBlocks.has(key)) {
          seenBlocks.add(key)
          publishCreditShortfall(shortfall)
        }
      }
    } catch { /* The caller still receives its original response. */ }
    return response
  }
}

export async function replayPendingAction(pending: CreditShortfall): Promise<unknown> {
  const request = pending.request
  if (!request || !REPLAYABLE_METHODS.has(request.method) || sameOriginPath(request.url) !== request.url) throw new Error("Nothing safe to resume.")
  const headers = new Headers(request.headers)
  let body: BodyInit | undefined
  if (request.bodyId) {
    const saved = await readCreditRequestBody(request.bodyId)
    if (!saved) throw new Error("Your saved upload has expired. Please select it again.")
    body = saved
  } else if (request.form !== null) {
    const form = new FormData()
    for (const [name, value] of request.form) form.append(name, value)
    body = form
  } else if (request.body !== null) {
    body = request.body
  }
  if (request.contentType) headers.set("content-type", request.contentType)
  // Replaying must not recapture the body or replace the pending action on another refusal.
  const send = typeof window === "undefined" ? fetch : (window as CreditGateWindow).__ataiCreditGateFetch ?? fetch
  const res = await send(request.url, { method: request.method, credentials: "include", headers, body })
  const contentType = res.headers.get("content-type") ?? ""
  let payload: unknown
  if (contentType.includes("ndjson")) {
    const frames = (await res.text()).split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line) as Record<string, unknown>)
    const failure = frames.find((frame) => frame.error)
    if (res.ok && !failure && !frames.some((frame) => frame.done === true)) {
      throw new Error("The reply ended before completion could be confirmed. Check your conversation before trying again.")
    }
    payload = failure ? { ok: false, error: failure.error } : frames
  } else if (contentType.includes("json")) {
    payload = await res.json()
  } else {
    payload = await res.text()
  }
  const envelope = payload as { ok?: boolean; error?: { code?: string; message?: string; meta?: unknown } } | null
  if (!res.ok || envelope?.ok === false) {
    throw Object.assign(new Error(envelope?.error?.message ?? "Could not resume your action."), {
      code: envelope?.error?.code, meta: envelope?.error?.meta, status: res.status,
    })
  }
  return envelope && typeof envelope === "object" && "data" in envelope ? envelope.data : payload
}
