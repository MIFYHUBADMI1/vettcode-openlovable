"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CreditGateDialog } from "@/components/billing/credit-gate-dialog"
import { applyCheckoutReturn } from "@/lib/billing/checkout-return-client"
import { selectSession, useClientStore } from "@/lib/store/client-store"
import {
  installCreditGateInterceptor,
  isInsufficientCreditsCode,
  peekPendingAction,
  replayPendingAction,
  subscribeToCreditGate,
  takePaymentHandoff,
  takePendingAction,
  type CreditShortfall,
} from "@/lib/client/credit-gate"

// Wrapped before React renders, so the very first credit request on the page is
// already covered.
installCreditGateInterceptor()

/** Credits usually arrive before the founder even finishes reading the receipt,
 * but the payment webhook can trail the redirect. Check the fast window first… */
const CONFIRM_DELAYS_MS = [0, 2_000, 5_000, 9_000]
/** …then keep watching quietly, so a slow webhook still resumes the work by
 * itself instead of leaving them to press the button again. */
const WATCH_INTERVAL_MS = 20_000
const WATCH_HORIZON_MS = 10 * 60 * 1000

function canResume(pending: CreditShortfall, available: number): boolean {
  if (pending.required !== null) return available >= pending.required
  if (pending.available !== null) return available > pending.available
  return available > 0
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function CreditGateProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const session = useClientStore(selectSession)
  const [shortfall, setShortfall] = useState<CreditShortfall | null>(null)
  const [open, setOpen] = useState(false)
  const [watching, setWatching] = useState<CreditShortfall | null>(null)
  const resumeRan = useRef(false)

  useEffect(
    () =>
      subscribeToCreditGate((signal) => {
        if (signal.pipeline && signal.required !== null) {
          // A recorded block is a moment in time. If the balance already covers
          // the step, the founder paid and the run will pick up on its own.
          const available = useClientStore.getState().session?.credits.available
          if (typeof available === "number" && available >= signal.required) return
        }
        setShortfall(signal)
        setOpen(true)
      }),
    [],
  )

  const resumeNow = useCallback(
    async (pending: CreditShortfall) => {
      const action = takePendingAction()
      if (!action) return
      setWatching(null)
      setOpen(false)
      const running = toast.loading(`Picking up ${action.action}…`)
      try {
        await replayPendingAction(action)
        toast.success(`You're back in business — ${action.action} is running.`, { id: running })
        await useClientStore.getState().invalidateSession()
        router.refresh()
      } catch (error) {
        const err = error as { code?: string; message?: string }
        if (isInsufficientCreditsCode(err.code)) {
          // Still not funded (a refund, a second device, a partial top-up).
          toast.dismiss(running)
          setShortfall({ ...action, message: err.message ?? action.message })
          setOpen(true)
          setWatching(action)
          return
        }
        toast.error(err.message ?? `Couldn't restart ${action.action} on its own — trigger it once more.`, {
          id: running,
        })
      }
    },
    [router],
  )

  // Coming back from the payment page: confirm the credits, then finish the job.
  useEffect(() => {
    if (resumeRan.current) return
    resumeRan.current = true

    void (async () => {
      if (!takePaymentHandoff()) return
      const pending = peekPendingAction()
      if (!pending) return

      const search = new URLSearchParams(window.location.search)
      // `/settings/billing` already syncs the subscription on render; don't POST twice.
      if (search.get("subscription_id") && window.location.pathname !== "/settings/billing") {
        await applyCheckoutReturn(search).catch(() => "none" as const)
      }

      const confirming = toast.loading("Confirming your payment…")
      let available: number | null = null
      for (const delay of CONFIRM_DELAYS_MS) {
        if (delay) await wait(delay)
        await useClientStore.getState().invalidateSession()
        const current = useClientStore.getState().session
        if (!current) {
          toast.dismiss(confirming)
          return
        }
        available = current.credits.available
        if (canResume(pending, available)) break
      }
      toast.dismiss(confirming)

      if (available !== null && canResume(pending, available)) {
        await resumeNow(pending)
        return
      }

      // Nothing has landed yet. Put the offer back on screen, keep the
      // interrupted request saved, and carry on as soon as the credits show up.
      setShortfall(pending)
      setOpen(true)
      setWatching(pending)
      toast.message(
        "We haven't seen your credits yet. Leave this tab open — this picks up by itself the moment they arrive.",
      )
    })()
  }, [resumeNow, router])

  // The patient watch: a webhook that arrives a minute late must still resume.
  useEffect(() => {
    if (!watching) return
    const deadline = watching.at + WATCH_HORIZON_MS
    let cancelled = false

    const timer = setInterval(async () => {
      if (cancelled) return
      if (Date.now() > deadline) {
        setWatching(null)
        return
      }
      await useClientStore.getState().invalidateSession()
      const current = useClientStore.getState().session
      if (cancelled) return
      if (!current) {
        setWatching(null)
        return
      }
      if (canResume(watching, current.credits.available)) void resumeNow(watching)
    }, WATCH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [resumeNow, watching])

  return (
    <>
      {children}
      <CreditGateDialog open={open && Boolean(session)} shortfall={shortfall} onOpenChange={setOpen} />
    </>
  )
}
