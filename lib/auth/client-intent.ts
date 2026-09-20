import { postJson } from "@/lib/client/api"
import { useClientStore } from "@/lib/store/client-store"

export const PENDING_START_KEY = "atai:pending-start"
export const REFERRAL_KEY = "referral_code"

export type AuthView = "login" | "signup" | "forgot" | "forgot-sent" | "verify"

export type PendingStart = {
  prompt: string
  href: string
  source?: string
  signalType?: "url" | "idea"
  mode?: "idea" | "website" | "url" | "github"
  pipelineMode?: "legacy" | "heavy"
  idempotencyKey?: string
}

export function sanitizeNext(value?: string | null, fallback = "/dashboard"): string {
  if (!value) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  if (value.includes("://")) return fallback
  return value
}

function withIdempotency(data: PendingStart): PendingStart {
  if (data.idempotencyKey) return data
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return { ...data, idempotencyKey: key }
}

export function savePendingStart(data: PendingStart) {
  if (typeof window === "undefined") return
  const next = withIdempotency(data)
  sessionStorage.setItem(PENDING_START_KEY, JSON.stringify(next))
  void persistPendingStart(next)
}

export async function persistPendingStart(data?: PendingStart | null) {
  if (typeof window === "undefined") return
  const pending = data ?? peekPendingStart()
  if (!pending?.prompt) return
  try {
    await fetch("/api/start/pending", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      credentials: "include",
      body: JSON.stringify(pending),
    })
  } catch {
    /* cookie/sessionStorage still hold a local copy */
  }
}

export async function restorePendingStart(): Promise<PendingStart | null> {
  const local = peekPendingStart()
  if (local) return local
  try {
    const res = await fetch("/api/start/pending", { headers: { accept: "application/json" }, credentials: "include" })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; data?: { pending?: PendingStart | null } } | null
    const pending = body?.ok ? body.data?.pending ?? null : null
    if (pending?.prompt) {
      sessionStorage.setItem(PENDING_START_KEY, JSON.stringify(pending))
      return pending
    }
  } catch {
    /* fall through */
  }
  return null
}

export function peekPendingStart(): PendingStart | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PENDING_START_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingStart
    if (!parsed?.prompt || !parsed?.href) return null
    return parsed
  } catch {
    return null
  }
}

export function takePendingStart(): PendingStart | null {
  const pending = peekPendingStart()
  if (typeof window !== "undefined") sessionStorage.removeItem(PENDING_START_KEY)
  if (typeof window !== "undefined") {
    void fetch("/api/start/pending", { method: "DELETE", credentials: "include" }).catch(() => undefined)
  }
  return pending
}

export function persistReferralCode(code?: string | null) {
  if (typeof window === "undefined") return
  const value = code?.trim()
  if (value) sessionStorage.setItem(REFERRAL_KEY, value)
}

export function getReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined
  return sessionStorage.getItem(REFERRAL_KEY) || undefined
}

export function clearReferralCode() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(REFERRAL_KEY)
}

export function buildOAuthHref(
  provider: "google" | "github",
  options?: { next?: string | null; ref?: string | null },
): string {
  const params = new URLSearchParams()
  const next = options?.next ? sanitizeNext(options.next, "") : ""
  if (next) params.set("next", next)
  const ref = options?.ref?.trim()
  if (ref) params.set("ref", ref)
  const qs = params.toString()
  return `/api/auth/${provider}${qs ? `?${qs}` : ""}`
}

export function humanizeAuthError(error: unknown): string {
  if (error instanceof Error && error.message) {
    const message = error.message.trim()
    if (/supabase|firebase|authapierror|mongodb|internal server|stack/i.test(message)) {
      return "Something went wrong. Please try again."
    }
    return message
  }
  return "Something went wrong. Please try again."
}

export async function refreshSessionAfterAuth() {
  await useClientStore.getState().fetchSession()
  if (!useClientStore.getState().session?.user) {
    throw new Error("We signed you in, but couldn't load your session. Please try again.")
  }
}

export async function loginWithPassword(email: string, password: string) {
  await postJson("/api/auth/login", { email, password })
  await refreshSessionAfterAuth()
}

export async function registerWithPassword(payload: {
  name: string
  email: string
  password: string
  ref?: string
}) {
  await postJson("/api/auth/register", payload)
  clearReferralCode()
  await refreshSessionAfterAuth()
}

export async function requestPasswordReset(email: string) {
  await postJson("/api/auth/forgot-password", { email })
}

export async function resendVerificationEmail() {
  await postJson("/api/auth/resend-verification")
}
