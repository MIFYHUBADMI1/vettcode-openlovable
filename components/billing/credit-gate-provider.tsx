"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { mutate } from "swr"
import { toast } from "sonner"
import { CreditGateDialog } from "@/components/billing/credit-gate-dialog"
import { postJson } from "@/lib/client/api"
import { selectSession, useClientStore } from "@/lib/store/client-store"
import {
  clearPaymentHandoff, clearPendingAction, hasPaymentHandoff, installCreditGateInterceptor,
  isInsufficientCreditsCode, parseCreditShortfall, peekPendingAction, replayPendingAction,
  savePendingAction, subscribeToCreditGate, type CreditShortfall,
} from "@/lib/client/credit-gate"

installCreditGateInterceptor()
const CONFIRM_DELAYS_MS = [2_000, 5_000, 9_000]
const WATCH_INTERVAL_MS = 20_000
const WATCH_HORIZON_MS = 10 * 60 * 1000

export function canResumeCreditAction(pending: CreditShortfall, available: number): boolean {
  if (pending.required !== null) return available >= pending.required
  if (pending.available !== null) return available > pending.available
  return available > 0
}

export function CreditGateProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const session = useClientStore(selectSession)
  const [shortfall, setShortfall] = useState<CreditShortfall | null>(null)
  const [open, setOpen] = useState(false)
  const [watching, setWatching] = useState<CreditShortfall | null>(null)
  const [resumeError, setResumeError] = useState<string | null>(null)
  const running = useRef(false)
  const returnedFor = useRef<string | null>(null)
  const watchStartedAt = useRef(0)

  useEffect(() => subscribeToCreditGate((signal) => {
    const current = useClientStore.getState().session
    if (!current) {
      clearPendingAction()
      return
    }
    if (signal.pipeline && !hasPaymentHandoff() && signal.required !== null && current.credits.available >= signal.required) return
    const owned = { ...signal, userId: current.userId }
    if (!signal.request || !savePendingAction(owned)) {
      clearPendingAction()
      owned.request = null
    }
    setShortfall(owned)
    setResumeError(null)
    setOpen(true)
  }), [])

  const resumeNow = useCallback(async (pending: CreditShortfall): Promise<boolean> => {
    if (running.current) return false
    const action = peekPendingAction()
    const current = useClientStore.getState().session
    if (!action || action.at !== pending.at || !current || action.userId !== current.userId) return false
    if (!canResumeCreditAction(action, current.credits.available)) return false
    running.current = true
    const notice = toast.loading(`Picking up ${action.action}…`)
    try {
      try {
        await replayPendingAction(action)
      } catch (error) {
        const err = error as { status?: number }
        if (!action.pipeline || err.status !== 409 || !action.request) throw error
        const url = action.request.url.replace(/\/(launch|retry)$/, "")
        const response = await fetch(url)
        const envelope = await response.json() as { ok?: boolean; data?: { project?: { state?: string; specification?: unknown; totalumProjectId?: string } } }
        const project = envelope.data?.project
        const pickedUp = /\/launch$/.test(action.request.url)
          ? project?.totalumProjectId || ["building", "built", "deploying", "deployed"].includes(project?.state ?? "")
          : project?.specification || ["analyzing", "analysis_complete", "pending_plan", "plan_ready"].includes(project?.state ?? "")
        if (!response.ok || !envelope.ok || !pickedUp) throw error
      }
      if (peekPendingAction()?.at === action.at) {
        clearPendingAction()
        clearPaymentHandoff()
        setWatching(null)
        setOpen(false)
        setResumeError(null)
      }
      toast.success(`Resumed ${action.action}.`, { id: notice })
      await useClientStore.getState().invalidateSession()
      void mutate(() => true, undefined, { revalidate: true }).catch(() => {})
      router.refresh()
      return true
    } catch (error) {
      const err = error as { code?: string; message?: string; meta?: unknown }
      toast.dismiss(notice)
      if (isInsufficientCreditsCode(err.code)) {
        const updated = parseCreditShortfall({ ok: false, error: err }, action.request) ?? action
        const next = { ...updated, userId: action.userId, pipeline: action.pipeline }
        savePendingAction(next)
        setShortfall(next)
        setOpen(true)
        return false
      }
      const message = err.message ?? "Your action could not resume. Please try again."
      setResumeError(message)
      setOpen(true)
      setWatching(null)
      clearPaymentHandoff()
      toast.error(message)
      return false
    } finally {
      running.current = false
    }
  }, [router])

  useEffect(() => {
    if (!session || returnedFor.current === session.userId || !hasPaymentHandoff()) return
    returnedFor.current = session.userId
    const pending = peekPendingAction()
    if (!pending || pending.userId !== session.userId) {
      clearPendingAction()
      clearPaymentHandoff()
      return
    }
    const search = new URLSearchParams(window.location.search)
    if (["failed", "cancelled", "canceled"].includes(search.get("status") ?? "")) {
      clearPaymentHandoff()
      setShortfall(pending)
      setOpen(true)
      return
    }
    void (async () => {
      const subscriptionId = search.get("subscription_id")
      if (subscriptionId && window.location.pathname !== "/settings/billing") {
        await postJson("/api/billing/sync", { subscriptionId }).catch(() => {})
      }
      if (useClientStore.getState().session?.userId !== session.userId) return
      watchStartedAt.current = Date.now()
      setShortfall(pending)
      setOpen(true)
      setWatching(pending)
    })()
  }, [session?.userId])

  useEffect(() => {
    if (!watching) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let checks = 0
    const check = async () => {
      await useClientStore.getState().invalidateSession()
      if (cancelled) return
      const current = useClientStore.getState().session
      const pending = peekPendingAction()
      if (!current || !pending || pending.userId !== current.userId) {
        setWatching(null)
        clearPaymentHandoff()
        return
      }
      if (canResumeCreditAction(pending, current.credits.available)) {
        if (await resumeNow(pending) || !hasPaymentHandoff()) return
      }
      if (cancelled) return
      if (Date.now() - watchStartedAt.current >= WATCH_HORIZON_MS) {
        setWatching(null)
        clearPaymentHandoff()
        setResumeError("Your credits have not arrived yet. You can continue here once they do, or check billing for help.")
        return
      }
      timer = setTimeout(() => void check(), CONFIRM_DELAYS_MS[checks++] ?? WATCH_INTERVAL_MS)
    }
    void check()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [resumeNow, watching])

  const dismiss = (value: boolean) => {
    setOpen(value)
    if (!value) {
      setWatching(null)
      clearPaymentHandoff()
    }
  }
  return <>
    {children}
    <CreditGateDialog
      open={open && Boolean(session)} shortfall={shortfall} onOpenChange={dismiss}
      checking={Boolean(watching)} resumeError={resumeError}
      onResume={() => { const pending = peekPendingAction(); if (pending) void resumeNow(pending) }}
    />
  </>
}
