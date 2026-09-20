"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BrandMark } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { useProjects, useSession } from "@/lib/client/api"
import { peekPendingStart, restorePendingStart, savePendingStart } from "@/lib/auth/client-intent"
import { recordOnboardingDismissed } from "@/lib/onboarding/activate"
import { ONBOARDING_COPY, MODE_COPY } from "@/lib/onboarding/copy"
import {
  FIRST_MISSION_DRAFT_KEY,
  composeVision,
  followUpPrompt,
  needsFollowUp,
  resolveFirstMissionSurface,
  signalForMode,
  sourceForMode,
} from "@/lib/onboarding/state"
import {
  detectStartMode,
  promptForStart,
  validateStartInput,
  type StartMode,
} from "@/lib/start/detect-input"
import { cn } from "@/lib/utils"

const MODES: StartMode[] = ["idea", "website", "url", "github"]

export function FirstMission() {
  return (
    <Suspense fallback={null}>
      <FirstMissionInner />
    </Suspense>
  )
}

function FirstMissionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, isLoading: sessionLoading, refresh } = useSession()
  const { projects, isLoading: projectsLoading } = useProjects()
  const [vision, setVision] = useState("")
  const [mode, setMode] = useState<StartMode>("idea")
  const [modeTouched, setModeTouched] = useState(false)
  const [followUp, setFollowUp] = useState("")
  const [phase, setPhase] = useState<"vision" | "context">("vision")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pending = typeof window === "undefined" ? null : peekPendingStart()
  const surface = resolveFirstMissionSurface({
    isReady: !sessionLoading && !projectsLoading && Boolean(session),
    projectCount: projects.length,
    completedAt: session?.user.onboarding?.completedAt,
    dismissedAt: session?.user.onboarding?.dismissedAt,
    hasPendingStart: Boolean(pending?.prompt && pending.href),
    forceMission: searchParams.get("mission") === "1",
  })

  useEffect(() => {
    if (surface !== "redirect-pending") return
    void restorePendingStart().then((restored) => {
      router.replace(restored?.href || "/start")
    })
  }, [surface, router])

  useEffect(() => {
    if (surface !== "mission" || !session) return
    try {
      const raw = sessionStorage.getItem(`${FIRST_MISSION_DRAFT_KEY}:${session.user.id}`)
      if (raw) setVision(raw)
    } catch {
      /* ignore */
    }
  }, [surface, session])

  useEffect(() => {
    if (surface !== "mission" || !session) return
    try {
      sessionStorage.setItem(`${FIRST_MISSION_DRAFT_KEY}:${session.user.id}`, vision)
    } catch {
      /* ignore */
    }
  }, [vision, surface, session])

  const detected = useMemo(() => detectStartMode(vision), [vision])
  const effectiveMode = modeTouched ? mode : (detected ?? mode)

  const askFollowUp = phase === "context" && needsFollowUp(effectiveMode, vision)

  if (surface !== "mission") return null

  const firstName = session?.user.name?.trim().split(/\s+/)[0]

  async function skip() {
    setBusy(true)
    setError(null)
    try {
      await recordOnboardingDismissed()
      await refresh()
    } catch {
      setError(ONBOARDING_COPY.skipError)
      setBusy(false)
    }
  }

  function continueFromVision() {
    const message = validateStartInput(effectiveMode, vision)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    if (needsFollowUp(effectiveMode, vision)) {
      setPhase("context")
      return
    }
    goToCreate()
  }

  function goToCreate() {
    const composed = composeVision(promptForStart(effectiveMode, vision), followUp)
    const href = "/start"
    savePendingStart({
      prompt: composed,
      href,
      source: sourceForMode(effectiveMode, "dashboard"),
      signalType: signalForMode(effectiveMode),
      mode: effectiveMode,
      pipelineMode: "heavy",
    })
    router.push(href)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground motion-reduce:transition-none">
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4 lg:px-10">
        <BrandMark />
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {phase === "vision" ? ONBOARDING_COPY.eyebrow : ONBOARDING_COPY.contextEyebrow}
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 overflow-y-auto px-6 py-10">
        {firstName ? (
          <p className="text-sm text-muted-foreground">Welcome, {firstName}.</p>
        ) : null}

        {phase === "vision" ? (
          <>
            <div>
              <h1 className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
                {ONBOARDING_COPY.visionHeading}
              </h1>
              <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-muted-foreground">
                {ONBOARDING_COPY.visionDescription}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <label htmlFor="atai-vision" className="sr-only">
                {ONBOARDING_COPY.visionLabel}
              </label>
              <textarea
                id="atai-vision"
                value={vision}
                onChange={(event) => {
                  setVision(event.target.value)
                  if (!modeTouched) {
                    const next = detectStartMode(event.target.value)
                    if (next) setMode(next)
                  }
                }}
                placeholder={ONBOARDING_COPY.visionPlaceholder}
                rows={6}
                className="w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-base leading-7 outline-none placeholder:text-muted-foreground focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
              />
              {detected && !modeTouched ? (
                <p className="text-xs text-muted-foreground">
                  Detected: {MODE_COPY[detected].label} reference.{" "}
                  <button type="button" className="underline-offset-4 hover:underline" onClick={() => setModeTouched(true)}>
                    Change
                  </button>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Starting point">
                {MODES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setMode(id)
                      setModeTouched(true)
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      effectiveMode === id
                        ? "border-indigo-500/40 bg-indigo-500/10"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {MODE_COPY[id].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{MODE_COPY[effectiveMode].hint}</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {ONBOARDING_COPY.examples.map((example) => (
                  <li key={example}>“{example}”</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{ONBOARDING_COPY.gotIt}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{followUpPrompt(effectiveMode)}</h1>
              <p className="mt-3 rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                {vision.trim()}
              </p>
            </div>
            <div>
              <label htmlFor="atai-followup" className="text-sm font-medium">
                {followUpPrompt(effectiveMode)}
              </label>
              <textarea
                id="atai-followup"
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
                placeholder={ONBOARDING_COPY.audiencePlaceholder}
                rows={3}
                className="mt-2 w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{ONBOARDING_COPY.capabilitiesIntro}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {ONBOARDING_COPY.capabilities.map((item) => (
                  <li key={item} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>

      <footer className="border-t border-border/60 px-6 py-4 lg:px-10">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <Button variant="ghost" onClick={skip} disabled={busy} className="text-muted-foreground">
            {ONBOARDING_COPY.secondaryCta}
          </Button>
          {phase === "vision" ? (
            <Button onClick={continueFromVision} disabled={busy}>
              {askFollowUp || needsFollowUp(effectiveMode, vision) ? "Continue" : ONBOARDING_COPY.primaryCta}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => goToCreate()} disabled={busy}>
                {ONBOARDING_COPY.enoughCta}
              </Button>
              <Button onClick={() => goToCreate()} disabled={busy}>
                {ONBOARDING_COPY.primaryCta}
              </Button>
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
