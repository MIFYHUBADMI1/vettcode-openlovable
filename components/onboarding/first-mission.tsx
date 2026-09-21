"use client"

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BrandMark } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { ChoiceGrid } from "@/components/onboarding/choice-grid"
import { OnboardingPlanStep } from "@/components/onboarding/plan-step"
import { useProjects, useSession } from "@/lib/client/api"
import { peekPendingStart, restorePendingStart, resendVerificationEmail, savePendingStart } from "@/lib/auth/client-intent"
import { recordOnboardingDismissed, saveOnboardingProfile } from "@/lib/onboarding/activate"
import { ONBOARDING_COPY, MODE_COPY } from "@/lib/onboarding/copy"
import {
  ONBOARDING_INTENTS,
  ONBOARDING_PACE,
  ONBOARDING_REVENUE_TARGETS,
  ONBOARDING_ROLES,
  ONBOARDING_SOURCES,
  ONBOARDING_USER_TARGETS,
} from "@/lib/onboarding/profile"
import {
  FIRST_MISSION_DRAFT_KEY,
  composeVision,
  followUpPrompt,
  missionBeatList,
  missionProgress,
  needsFollowUp,
  parseFirstMissionDraft,
  pathWithoutMissionParam,
  resolveFirstMissionSurface,
  signalForMode,
  sourceForMode,
  type MissionBeat,
} from "@/lib/onboarding/state"
import {
  detectStartMode,
  promptForStart,
  validateStartInput,
  type StartMode,
} from "@/lib/start/detect-input"
import { cn } from "@/lib/utils"

const MODES: StartMode[] = ["idea", "website", "url", "github"]

const BEAT_TITLE: Record<MissionBeat, { heading: string; description: string }> = {
  vision: { heading: ONBOARDING_COPY.visionHeading, description: ONBOARDING_COPY.visionDescription },
  context: { heading: "", description: "" },
  source: {
    heading: "How did you find Atai?",
    description: "Helps us know where founders actually come from — one tap.",
  },
  role: {
    heading: "What best describes you?",
    description: "So Atai can talk to you like a teammate, not a generic chatbot.",
  },
  win: {
    heading: "What does winning look like?",
    description: "Pick the outcome you want Atai pointed at. You can change this later.",
  },
  users: {
    heading: "Who are you trying to reach?",
    description: "A scale, not a forecast. Nearest answer is fine.",
  },
  pace: {
    heading: "How hard are you going?",
    description: "This sets the pace of the plan — not a commitment.",
  },
  intent: {
    heading: "What should Atai help with?",
    description: "Builder only, or product and business together.",
  },
  plan: {
    heading: "Choose how you want to start.",
    description: "Stay on Free, or pick a plan. You can change this in billing anytime.",
  },
  verify: {
    heading: ONBOARDING_COPY.verifyHeading,
    description: ONBOARDING_COPY.verifyDescription,
  },
}

export function FirstMission() {
  return (
    <Suspense fallback={null}>
      <FirstMissionInner />
    </Suspense>
  )
}

function FirstMissionInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { session, refresh } = useSession()
  const { projects, isLoading: projectsLoading } = useProjects()
  const [vision, setVision] = useState("")
  const [mode, setMode] = useState<StartMode>("idea")
  const [modeTouched, setModeTouched] = useState(false)
  const [followUp, setFollowUp] = useState("")
  const [beat, setBeat] = useState<MissionBeat>("vision")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState("")
  const [role, setRole] = useState("")
  const [building, setBuilding] = useState<"url" | "idea" | "">("")
  const [revenueTarget, setRevenueTarget] = useState("")
  const [targetUsers, setTargetUsers] = useState("")
  const [effortScale, setEffortScale] = useState<number | null>(null)
  const [hoursPerDay, setHoursPerDay] = useState("")
  const [intent, setIntent] = useState("")
  const [selectedPlanId, setSelectedPlanId] = useState("free")
  const [closed, setClosed] = useState(false)
  const hydrated = useRef(false)
  const advanceTimer = useRef<number | null>(null)

  const pending = typeof window === "undefined" ? null : peekPendingStart()
  const surface = resolveFirstMissionSurface({
    isReady: Boolean(session) && !projectsLoading,
    projectCount: projects.length,
    completedAt: session?.user.onboarding?.completedAt,
    dismissedAt: session?.user.onboarding?.dismissedAt,
    hasPendingStart: Boolean(pending?.prompt && pending.href),
    forceMission: !closed && searchParams.get("mission") === "1",
  })

  useEffect(() => {
    if (surface !== "redirect-pending") return
    void restorePendingStart().then((restored) => {
      router.replace(restored?.href || "/start")
    })
  }, [surface, router])

  useEffect(() => {
    if (surface !== "mission" || !session || hydrated.current) return
    hydrated.current = true
    const existing = session.user.onboarding
    try {
      const draft = parseFirstMissionDraft(sessionStorage.getItem(`${FIRST_MISSION_DRAFT_KEY}:${session.user.id}`))
      if (draft?.vision) setVision(draft.vision)
      if (draft?.followUp) setFollowUp(draft.followUp)
      if (draft?.mode) setMode(draft.mode)
      if (draft?.modeTouched) setModeTouched(true)
      if (draft?.beat) setBeat(draft.beat)
      if (draft?.source) setSource(draft.source)
      if (draft?.role) setRole(draft.role)
      if (draft?.building) setBuilding(draft.building)
      if (draft?.revenueTarget) setRevenueTarget(draft.revenueTarget)
      if (draft?.targetUsers) setTargetUsers(draft.targetUsers)
      if (typeof draft?.effortScale === "number") setEffortScale(draft.effortScale)
      if (draft?.hoursPerDay) setHoursPerDay(draft.hoursPerDay)
      if (draft?.intent) setIntent(draft.intent)
      if (draft?.selectedPlanId) setSelectedPlanId(draft.selectedPlanId)
    } catch {
      /* ignore */
    }
    if (existing?.source) setSource((current) => current || existing.source || "")
    if (existing?.role) setRole((current) => current || existing.role || "")
    if (existing?.signalType) setBuilding((current) => current || existing.signalType || "")
    if (existing?.revenueTarget) setRevenueTarget((current) => current || existing.revenueTarget || "")
    if (existing?.targetUsers) setTargetUsers((current) => current || existing.targetUsers || "")
    if (existing?.effortScale) setEffortScale((current) => current ?? existing.effortScale ?? null)
    if (existing?.hoursPerDay) setHoursPerDay((current) => current || existing.hoursPerDay || "")
    if (existing?.intent) setIntent((current) => current || existing.intent || "")
    if (existing?.selectedPlanId) setSelectedPlanId((current) => (current !== "free" ? current : existing.selectedPlanId || "free"))
    if (existing?.businessDescription) setVision((current) => current || existing.businessDescription || "")
  }, [surface, session])

  const detected = useMemo(() => detectStartMode(vision), [vision])
  const effectiveMode = modeTouched ? mode : (detected ?? mode)
  const includeContext = beat === "context" || needsFollowUp(effectiveMode, vision)
  useEffect(() => {
    if (beat !== "verify") return
    if (session?.user.emailVerified) {
      if (needsFollowUp(effectiveMode, vision)) setBeat("context")
      else setBeat("source")
      return
    }
    void resendVerificationEmail().catch(() => undefined)
  }, [beat, session?.user.emailVerified, effectiveMode, vision])

  const includeVerify = Boolean(session && !session.user.emailVerified) || beat === "verify"
  const beats = missionBeatList(includeContext && beat !== "vision", includeVerify && beat !== "vision")
  const progress = missionProgress(beat, includeContext && beat !== "vision", includeVerify && beat !== "vision")

  useEffect(() => {
    if (surface !== "mission" || !session) return
    try {
      sessionStorage.setItem(
        `${FIRST_MISSION_DRAFT_KEY}:${session.user.id}`,
        JSON.stringify({
          vision,
          followUp,
          mode: effectiveMode,
          modeTouched,
          beat,
          source,
          role,
          building,
          revenueTarget,
          targetUsers,
          effortScale,
          hoursPerDay,
          intent,
          selectedPlanId,
        }),
      )
    } catch {
      /* ignore */
    }
  }, [
    vision,
    followUp,
    effectiveMode,
    modeTouched,
    beat,
    source,
    role,
    building,
    revenueTarget,
    targetUsers,
    effortScale,
    hoursPerDay,
    intent,
    selectedPlanId,
    surface,
    session,
  ])

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    }
  }, [])

  if (closed || surface !== "mission") return null

  const firstName = session?.user.name?.trim().split(/\s+/)[0]
  const profilePayload = {
    source: source || undefined,
    role: role || undefined,
    signalType: (building || signalForMode(effectiveMode)) as "url" | "idea",
    businessDescription: vision.trim() || undefined,
    businessGoal: vision.trim() || undefined,
    revenueTarget: revenueTarget || undefined,
    targetUsers: targetUsers || undefined,
    effortScale: effortScale ?? undefined,
    hoursPerDay: hoursPerDay || undefined,
    intent: intent || undefined,
    selectedPlanId,
  }

  function persistQuiet(extra?: Record<string, unknown>) {
    void saveOnboardingProfile({ ...profilePayload, ...extra }).catch(() => {})
  }

  function go(next: MissionBeat, extra?: Record<string, unknown>) {
    setError(null)
    setBeat(next)
    persistQuiet(extra)
  }

  function advanceTo(next: MissionBeat, extra?: Record<string, unknown>) {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    persistQuiet(extra)
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    advanceTimer.current = window.setTimeout(() => {
      setError(null)
      setBeat(next)
    }, reduced ? 0 : 140)
  }

  function previousBeat() {
    const list = missionBeatList(includeContext && beat !== "vision", includeVerify && beat !== "vision")
    const index = list.indexOf(beat)
    if (index <= 0) {
      setBeat("vision")
      return
    }
    setBeat(list[index - 1] ?? "vision")
  }

  function dropMissionFromUrl() {
    const next = pathWithoutMissionParam(pathname || "/dashboard", searchParams.toString())
    const current = `${pathname || "/dashboard"}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
    if (next !== current) router.replace(next, { scroll: false })
  }

  async function skip() {
    setBusy(true)
    setError(null)
    setClosed(true)
    dropMissionFromUrl()
    try {
      await saveOnboardingProfile(profilePayload)
      await recordOnboardingDismissed()
      await refresh()
    } catch {
      setClosed(false)
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
    if (!building) setBuilding(signalForMode(effectiveMode))
    persistQuiet({ signalType: signalForMode(effectiveMode), businessDescription: vision.trim() })
    if (session && !session.user.emailVerified) {
      go("verify")
      return
    }
    if (needsFollowUp(effectiveMode, vision)) {
      go("context")
      return
    }
    go("source")
  }

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      await saveOnboardingProfile(profilePayload)
      goToCreate()
    } catch {
      setError(ONBOARDING_COPY.skipError)
      setBusy(false)
    }
  }

  function persistStartIntent() {
    const composed = composeVision(promptForStart(effectiveMode, vision), followUp)
    if (!composed.trim()) return
    savePendingStart({
      prompt: composed,
      href: "/start",
      source: source || sourceForMode(effectiveMode, "dashboard"),
      signalType: building || signalForMode(effectiveMode),
      mode: effectiveMode,
      pipelineMode: "heavy",
    })
  }

  function goToCreate() {
    persistStartIntent()
    router.push("/start")
  }

  async function prepareCheckout() {
    persistStartIntent()
    await saveOnboardingProfile(profilePayload)
  }

  const title = beat === "context" ? followUpPrompt(effectiveMode) : BEAT_TITLE[beat].heading
  const description = beat === "context" ? "One line is enough. Skip if you already said it." : BEAT_TITLE[beat].description
  const showContinue =
    beat === "vision" || beat === "context" || beat === "plan" || hasBeatValue(beat, { source, role, revenueTarget, targetUsers, effortScale, intent })

  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 sm:px-6">
        <BrandMark />
        <div className="flex min-w-0 items-center gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Step {progress.step} of {progress.total}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void skip()}
            disabled={busy}
            className="text-muted-foreground"
            aria-label="Close onboarding"
          >
            Close
          </Button>
        </div>
      </div>
      <div className="h-0.5 shrink-0 bg-border/70" aria-hidden>
        <div
          className="h-full bg-indigo-500 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col justify-center gap-4 overflow-hidden px-4 py-4 sm:gap-5 sm:px-6">
        {firstName && beat === "vision" ? <p className="text-sm text-muted-foreground">Welcome, {firstName}.</p> : null}

        {beat === "vision" ? (
          <>
            <div>
              <h1 className="text-balance text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-xl text-pretty text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-col gap-3">
              <label htmlFor="atai-vision" className="sr-only">{ONBOARDING_COPY.visionLabel}</label>
              <textarea
                id="atai-vision"
                value={vision}
                autoFocus
                onChange={(event) => {
                  setVision(event.target.value)
                  if (!modeTouched) {
                    const next = detectStartMode(event.target.value)
                    if (next) setMode(next)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    continueFromVision()
                  }
                }}
                placeholder={ONBOARDING_COPY.visionPlaceholder}
                rows={3}
                className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-base leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-indigo-500/40 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Starting point">
                {MODES.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setMode(id)
                      setModeTouched(true)
                      setBuilding(signalForMode(id))
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm",
                      effectiveMode === id ? "border-indigo-500/40 bg-indigo-500/10" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {MODE_COPY[id].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{MODE_COPY[effectiveMode].hint}</p>
            </div>
          </>
        ) : null}

        {beat === "context" ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300">{ONBOARDING_COPY.gotIt}</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-2 truncate text-sm text-muted-foreground">{vision.trim()}</p>
            </div>
            <textarea
              value={followUp}
              autoFocus
              onChange={(event) => setFollowUp(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  go("source")
                }
              }}
              placeholder={ONBOARDING_COPY.audiencePlaceholder}
              rows={2}
              className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/20"
            />
          </div>
        ) : null}

        {beat === "source" ? (
          <BeatShell title={title} description={description}>
            <ChoiceGrid
              layout="cards"
              value={source}
              options={ONBOARDING_SOURCES}
              onChange={(id) => {
                setSource(id)
                advanceTo("role", { source: id })
              }}
            />
          </BeatShell>
        ) : null}

        {beat === "role" ? (
          <BeatShell title={title} description={description}>
            <ChoiceGrid
              layout="cards"
              value={role}
              options={ONBOARDING_ROLES}
              onChange={(id) => {
                setRole(id)
                advanceTo("win", { role: id })
              }}
            />
          </BeatShell>
        ) : null}

        {beat === "win" ? (
          <BeatShell title={title} description={description}>
            <ChoiceGrid
              layout="cards"
              value={revenueTarget}
              options={ONBOARDING_REVENUE_TARGETS}
              onChange={(id) => {
                setRevenueTarget(id)
                advanceTo("users", { revenueTarget: id })
              }}
            />
          </BeatShell>
        ) : null}

        {beat === "users" ? (
          <BeatShell title={title} description={description}>
            <ChoiceGrid
              layout="cards"
              value={targetUsers}
              options={ONBOARDING_USER_TARGETS}
              onChange={(id) => {
                setTargetUsers(id)
                advanceTo("pace", { targetUsers: id })
              }}
            />
          </BeatShell>
        ) : null}

        {beat === "pace" ? (
          <BeatShell title={title} description={description}>
            <ChoiceGrid
              layout="cards"
              value={ONBOARDING_PACE.find((item) => item.effortScale === effortScale)?.id}
              options={ONBOARDING_PACE}
              onChange={(id) => {
                const pace = ONBOARDING_PACE.find((item) => item.id === id)
                if (!pace) return
                setEffortScale(pace.effortScale)
                setHoursPerDay(pace.hoursPerDay)
                advanceTo("intent", { effortScale: pace.effortScale, hoursPerDay: pace.hoursPerDay })
              }}
            />
          </BeatShell>
        ) : null}

        {beat === "intent" ? (
          <BeatShell title={title} description={description}>
            <ChoiceGrid
              layout="cards"
              value={intent}
              options={ONBOARDING_INTENTS}
              onChange={(id) => {
                setIntent(id)
                advanceTo("plan", { intent: id })
              }}
            />
          </BeatShell>
        ) : null}

        {beat === "verify" ? (
          <VerifyEmailBeat
            email={session?.user.email ?? ""}
            verified={Boolean(session?.user.emailVerified)}
            busy={busy}
            onResend={async () => {
              setBusy(true)
              setError(null)
              try {
                const result = await resendVerificationEmail()
                if (result && typeof result === "object" && "alreadyVerified" in result) {
                  await refresh()
                  return
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't send the verification email.")
              } finally {
                setBusy(false)
              }
            }}
            onChecked={async () => {
              setBusy(true)
              setError(null)
              try {
                await refresh()
              } finally {
                setBusy(false)
              }
            }}
          />
        ) : null}

        {beat === "plan" ? (
          <OnboardingPlanStep
            selectedPlanId={selectedPlanId}
            onSelect={(id) => {
              setSelectedPlanId(id)
              persistQuiet({ selectedPlanId: id })
            }}
            onBeforeCheckout={() => prepareCheckout()}
          />
        ) : null}

        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </div>

      <footer className="shrink-0 border-t border-border/60 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {beat !== "vision" ? (
              <Button variant="ghost" onClick={previousBeat} disabled={busy} className="text-muted-foreground">
                Back
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => void skip()} disabled={busy} className="text-muted-foreground">
              {ONBOARDING_COPY.secondaryCta}
            </Button>
          </div>
          {beat === "vision" ? (
            <Button onClick={continueFromVision} disabled={busy}>Continue</Button>
          ) : null}
          {beat === "context" ? (
            <Button onClick={() => go("source")} disabled={busy}>Continue</Button>
          ) : null}
          {beat === "verify" ? (
            <Button
              onClick={() => {
                if (needsFollowUp(effectiveMode, vision)) go("context")
                else go("source")
              }}
              disabled={busy || !session?.user.emailVerified}
            >
              Continue
            </Button>
          ) : null}
          {beat !== "vision" && beat !== "context" && beat !== "plan" && showContinue ? (
            <Button
              onClick={() => {
                const list = beats
                const index = list.indexOf(beat)
                const next = list[index + 1]
                if (next) go(next)
              }}
              disabled={busy}
            >
              Continue
            </Button>
          ) : null}
          {beat === "plan" ? (
            <Button onClick={() => void finish()} disabled={busy}>
              {selectedPlanId === "free" ? ONBOARDING_COPY.primaryCta : "Continue with this plan"}
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  )
}


function VerifyEmailBeat({
  email,
  verified,
  busy,
  onResend,
  onChecked,
}: {
  email: string
  verified: boolean
  busy: boolean
  onResend: () => void | Promise<void>
  onChecked: () => void | Promise<void>
}) {
  return (
    <BeatShell title={ONBOARDING_COPY.verifyHeading} description={ONBOARDING_COPY.verifyDescription}>
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-6">
        <p>We sent a verification link to <span className="font-medium">{email}</span>.</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Open that email on this device or another.</li>
          <li>Click the confirmation link.</li>
          <li>Come back here and tap I&apos;ve verified.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">{ONBOARDING_COPY.verifySpam}</p>
        {verified ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">Email verified. Continue to keep going.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void onResend()} disabled={busy}>{ONBOARDING_COPY.verifyResend}</Button>
        <Button variant="ghost" onClick={() => void onChecked()} disabled={busy}>{ONBOARDING_COPY.verifyDone}</Button>
      </div>
    </BeatShell>
  )
}

function BeatShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col gap-3 sm:gap-4">
      <div className="shrink-0">
        <h1 className="text-balance text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
        <p className="mt-1 max-w-xl text-pretty text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function hasBeatValue(
  beat: MissionBeat,
  values: {
    source: string
    role: string
    revenueTarget: string
    targetUsers: string
    effortScale: number | null
    intent: string
  },
) {
  if (beat === "source") return Boolean(values.source)
  if (beat === "role") return Boolean(values.role)
  if (beat === "win") return Boolean(values.revenueTarget)
  if (beat === "users") return Boolean(values.targetUsers)
  if (beat === "pace") return Boolean(values.effortScale)
  if (beat === "intent") return Boolean(values.intent)
  return false
}
