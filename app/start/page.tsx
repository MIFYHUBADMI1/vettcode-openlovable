"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthGate } from "@/components/auth/auth-gate"
import { BrandMark } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { peekPendingStart, restorePendingStart, takePendingStart } from "@/lib/auth/client-intent"
import { useProjects, useSession } from "@/lib/client/api"
import { recordOnboardingActivation } from "@/lib/onboarding/activate"
import { createProjectFromPending } from "@/lib/projects/continue-start"
import { applyCheckoutReturn } from "@/lib/billing/checkout-return-client"
import { START_HREF } from "@/lib/start/detect-input"

const STEPS = [
  "Creating your Atai workspace",
  "Bringing your idea into context",
  "Ready to collaborate",
]

export default function StartContinuePage() {
  return (
    <AuthGate next="/start">
      <StartContinueInner />
    </AuthGate>
  )
}

function StartContinueInner() {
  const router = useRouter()
  const { refresh: refreshProjects } = useProjects()
  const { refresh: refreshSession } = useSession()
  const [status, setStatus] = useState<(typeof STEPS)[number]>(STEPS[0])
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void run()

    async function run() {
      const params = new URLSearchParams(window.location.search)
      if (params.get("subscription_id")) {
        await applyCheckoutReturn(params)
      }
      const pending = await restorePendingStart()
      if (!pending?.prompt) {
        router.replace("/new")
        return
      }
      setStatus(STEPS[0])
      try {
        const { project } = await createProjectFromPending(pending)
        takePendingStart()
        setStatus(STEPS[1])
        await Promise.all([refreshProjects(), refreshSession()]).catch(() => undefined)
        try {
          await recordOnboardingActivation({
            businessDescription: pending.prompt,
            source: pending.source,
            signalType: pending.signalType ?? (pending.mode === "idea" ? "idea" : "url"),
            destination: `/project/${project.id}/collaborate`,
          })
        } catch {
          /* activation is derived from project state */
        }
        setStatus(STEPS[2])
        router.replace(`/project/${project.id}/collaborate`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "We couldn't create your workspace yet.")
      }
    }
  }, [refreshProjects, refreshSession, router])

  if (error) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-foreground">
        <BrandMark />
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t create your workspace yet.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground" role="alert">
            {error}
          </p>
        </div>
        <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => {
              setError(null)
              started.current = false
              window.location.reload()
            }}
          >
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const pending = peekPendingStart()
              router.push(START_HREF[pending?.mode ?? "idea"])
            }}
          >
            Open form
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-foreground">
      <BrandMark />
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Setting up your workspace…</p>
      <h1 className="text-center text-2xl font-semibold tracking-tight" aria-live="polite">
        {status}
      </h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Atai already has your starting point. We&apos;ll open Collaborate next.
      </p>
    </main>
  )
}
