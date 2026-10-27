"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { cn, ensureProtocol } from "@/lib/utils"
import { postJson } from "@/lib/client/api"
import { getBuildMessage, getBuildMessages } from "@/lib/build-messages"

const ENCOURAGEMENTS = [
  "Rome wasn't built in a day. But your app will be. ⏳",
  "The AI is working harder than your last intern. And it doesn't need coffee. ☕",
  "Every great app started as someone staring at a loading screen.",
  "Your application is being forged in the fires of Mount Code. 🔥",
  "Hang tight — your app is undergoing its glow-up transformation. ✨",
  "Good things come to those who wait… and to those whose builds succeed on the first try. 🍀",
  "The code is flowing through the pipes like water. Pure. Clean. Production-ready.",
  "Patience is a virtue — especially when deploying to production.",
  "Why do programmers prefer dark mode? Because light attracts bugs. 🐛",
  "A SQL query walks into a bar, sees two tables, and asks: \"Can I JOIN you?\"",
  "There are 10 types of people — those who understand binary and those who don't.",
  "Why did the developer go broke? Because he used up all his cache. 💸",
  "Debugging is like being the detective in a crime movie where you're also the murderer. 🔍",
  "What's a programmer's favorite hangout place? Foo Bar. 🍺",
  "I would tell you a UDP joke, but you might not get it.",
  "What's the object-oriented way to become rich? Inheritance. 💰",
  "How many programmers does it take to change a light bulb? None — that's a hardware problem.",
  "The best thing about a Boolean is that even if you're wrong, you're only off by a bit.",
  "What do you call a snake that's 3.14 meters long? A Pi-thon. 🐍",
  "Why was the JavaScript developer sad? Because he didn't Node how to Express himself. 😢",
]

const FUN_FACTS = [
  "The first computer bug was an actual bug — a moth found in a Harvard Mark II in 1947.",
  "The first programmer, Ada Lovelace, wrote code in 1843 — over 100 years before modern computers.",
  "The average programmer writes about 50 lines of production-ready code per day.",
  "The first computer mouse was made of wood. 🪵",
  "Email was invented before the World Wide Web — in 1971 by Ray Tomlinson.",
  "Java was originally called 'Oak' and was designed for interactive television.",
  "The word 'debugging' was popularized by Grace Hopper in 1947.",
  "The most used programming language is JavaScript, powering 97% of websites.",
]

/** Shape returned by GET /api/projects/[id]/status */
interface StatusResponse {
  state: string
  progress?: number | null
  agentStatus?: string | null
  developmentUrl?: string
  events?: Array<{ id: string; at: number; level: string; stage: string; message: string }>
  transient?: boolean
  message?: string
}

const jsonFetcher = (url: string) =>
  fetch(url, { headers: { accept: "application/json" } }).then((r) => r.json())

interface BuildLoadingProps {
  projectId: string
  state?: string
  className?: string
  projectName?: string
  projectPurpose?: string
  sourceUrl?: string
}

export function BuildLoading({ projectId, state, className, projectName, projectPurpose, sourceUrl }: BuildLoadingProps) {
  const router = useRouter()
  const [elapsed, setElapsed] = useState(0)
  const [currentEncouragement, setCurrentEncouragement] = useState(0)
  const [showFunFact, setShowFunFact] = useState(false)
  const [optimisticState, setOptimisticState] = useState<"idle" | "success" | "failed">("idle")
  const [messageIndex, setMessageIndex] = useState(0)
  const [fadeClass, setFadeClass] = useState("animate-fade-in")

  // Poll /status every 3s — this endpoint polls Totalum server-side,
  // handles state transitions (done→ready, failed→build_failed),
  // reconciles credits, and surfaces agent messages.
  const { data } = useSWR<{ ok: boolean; data: StatusResponse }>(
    `/api/projects/${projectId}/status`,
    jsonFetcher,
    {
      refreshInterval: optimisticState !== "idle" ? 0 : 3000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
      onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 5) return
        setTimeout(() => revalidate({ retryCount: retryCount + 1 }), 5000)
      },
    },
  )

  const status = data?.data

  // Optimistically show success/failure the instant /status reports it.
  useEffect(() => {
    if (optimisticState !== "idle") return
    if (status?.state === "ready" || status?.state === "deployed") {
      setOptimisticState("success")
    } else if (status?.state === "build_failed" || status?.state === "deployment_failed") {
      setOptimisticState("failed")
    }
  }, [status?.state, optimisticState])

  // After showing the success animation, refresh the page.
  useEffect(() => {
    if (optimisticState === "success") {
      const timer = setTimeout(() => router.refresh(), 2500)
      return () => clearTimeout(timer)
    }
  }, [optimisticState, router])

  // Retry handler — POSTs to /build endpoint then resets to show the building state.
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const handleRetry = useCallback(async () => {
    setRetrying(true)
    setRetryError(null)
    try {
      await postJson(`/api/projects/${projectId}/build`, {})
      setOptimisticState("idle")
      router.refresh()
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Could not start build")
    } finally {
      setRetrying(false)
    }
  }, [projectId, router])

  // Timer for elapsed display.
  useEffect(() => {
    if (optimisticState !== "idle") return
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(interval)
  }, [optimisticState])

  // Rotate encouragement + fun fact every 8 seconds.
  useEffect(() => {
    if (optimisticState !== "idle") return
    const interval = setInterval(() => {
      setCurrentEncouragement((e) => (e + 1) % ENCOURAGEMENTS.length)
      setShowFunFact((f) => !f)
    }, 8000)
    return () => clearInterval(interval)
  }, [optimisticState])

  // Rotate main build message every 10 seconds with fade animation
  useEffect(() => {
    if (optimisticState !== "idle") return

    const total = getBuildMessages({ projectName, projectPurpose, sourceUrl }).length

    const interval = setInterval(() => {
      // Fade out
      setFadeClass("animate-fade-out")

      // Wait for fade out, then change message and fade in
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % total)
        setFadeClass("animate-fade-in")
      }, 300)
    }, 10000) // Change every 10 seconds

    return () => clearInterval(interval)
  }, [optimisticState, projectName, projectPurpose, sourceUrl])

  // Recent build events from the server.
  const recentEvents = useMemo(() => {
    if (!status?.events?.length) return []
    return status.events
      .filter((e) =>
        e.stage === "build" ||
        e.stage === "analyze" ||
        e.stage === "specify" ||
        e.stage === "planning"  // Include planning stage events
      )
      .slice(-8)  // Show more events (8 instead of 5)
  }, [status?.events])

  // ─── SUCCESS STATE ──────────────────────────────────────────────
  if (optimisticState === "success") {
    return (
      <div className={cn("flex flex-col gap-5", className)}>
        <div className="relative overflow-hidden rounded-2xl border border-success/30 bg-success/5 p-8 sm:p-10">
          {/* Confetti particles */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="absolute animate-confetti rounded-full"
                style={{
                  left: `${10 + (i * 7) % 80}%`,
                  top: `-5%`,
                  width: `${4 + (i % 3) * 2}px`,
                  height: `${4 + (i % 3) * 2}px`,
                  backgroundColor: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "hsl(var(--success))" : "hsl(var(--chart-4))",
                  ["--delay" as string]: `${i * 0.15}s`,
                  ["--duration" as string]: `${1.5 + (i % 3) * 0.5}s`,
                }}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-5">
              <div className="flex size-20 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/20">
                <svg
                  className="size-10 text-success animate-check-draw"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 13l4 4L19 7" className="animate-check-stroke" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-success">Build complete!</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Your application has been built and is ready to preview.
            </p>
            <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success transition-all duration-1000 ease-out" style={{ width: "100%" }} />
            </div>
            <p className="mt-2 font-mono text-[11px] text-success">100% complete</p>
            {status?.developmentUrl && (
              <a
                href={ensureProtocol(status.developmentUrl)}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-success-foreground transition-colors hover:bg-success/90"
              >
                Open preview ↗
              </a>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Redirecting to your workspace…</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── FAILURE STATE ──────────────────────────────────────────────
  if (optimisticState === "failed") {
    return (
      <div className={cn("flex flex-col gap-5", className)}>
        <div className="relative overflow-hidden rounded-2xl border border-destructive/30 bg-destructive/5 p-8 sm:p-10">
          <div className="relative flex flex-col items-center text-center">
            <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/20">
              <svg
                className="size-10 text-destructive animate-fail-shake"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 6l12 12" className="animate-x-draw" />
                <path d="M18 6L6 18" className="animate-x-draw" style={{ animationDelay: "0.15s" }} />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-destructive">Build failed</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {status?.message || "Something went wrong during the build. Your credits have been refunded."}
            </p>

            {retryError && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {retryError}
              </p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
                  retrying && "opacity-60 cursor-not-allowed",
                )}
              >
                {retrying ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Starting build…
                  </>
                ) : (
                  <>🔄 Build again</>
                )}
              </button>
              <button
                onClick={() => router.refresh()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Back to workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── BUILDING STATE (default) ──────────────────────────────────
  const realProgress = status?.progress
  const displayProgress = realProgress ?? Math.min(95, Math.floor((elapsed / 300) * 100))
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const isDeploying = state === "deploying"
  const agentStatus = status?.agentStatus

  // Determine current stage based on progress and events
  const buildStages = [
    { id: 1, name: "Research & Analysis", team: "Research Team", progress: 0, icon: "🔬", color: "text-blue-500" },
    { id: 2, name: "Architecture Design", team: "Engineering Team", progress: 15, icon: "🏗️", color: "text-violet-500" },
    { id: 3, name: "Frontend Development", team: "Product & Design Team", progress: 30, icon: "🎨", color: "text-pink-500" },
    { id: 4, name: "Backend Engineering", team: "Platform Team", progress: 50, icon: "⚙️", color: "text-amber-500" },
    { id: 5, name: "Integration & Testing", team: "QA Automation Team", progress: 70, icon: "🧪", color: "text-green-500" },
    { id: 6, name: "Optimization", team: "Performance Team", progress: 85, icon: "⚡", color: "text-cyan-500" },
    { id: 7, name: "Final Checks", team: "Launch Team", progress: 95, icon: "✓", color: "text-emerald-500" },
  ]

  const currentStage = buildStages.reduce((prev, curr) =>
    displayProgress >= curr.progress ? curr : prev
  )

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Main card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-primary via-primary/50 to-primary" />
        </div>

        <div className="relative flex flex-col items-center text-center">
          {/* Animated Stage Icon */}
          <div className="mb-5 relative">
            <div className="size-20 flex items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/20 animate-pulse">
              <span className="text-4xl animate-bounce" style={{ animationDuration: "2s" }}>
                {currentStage.icon}
              </span>
            </div>
            {/* Orbiting dots */}
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: "8s" }}>
              <span className="absolute top-0 left-1/2 -ml-1 size-2 rounded-full bg-primary" />
            </div>
            <div className="absolute inset-0 animate-spin" style={{ animationDuration: "6s", animationDirection: "reverse" }}>
              <span className="absolute bottom-0 left-1/2 -ml-1 size-2 rounded-full bg-primary/70" />
            </div>
          </div>

          {/* Current Stage Info */}
          <div className="mb-4">
            <p className={cn("text-xs font-semibold uppercase tracking-wider mb-1", currentStage.color)}>
              Stage {currentStage.id} of {buildStages.length}
            </p>
            <h3 className="text-base font-bold text-foreground mb-0.5">
              {currentStage.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {currentStage.team} at work
            </p>
          </div>

          {/* Status heading with rotating project-specific message */}
          <h2 className={cn(
            "text-lg font-semibold text-foreground transition-opacity duration-500 text-balance text-center max-w-md",
            fadeClass
          )}>
            {getBuildMessage(messageIndex, { projectName, projectPurpose, sourceUrl })}
          </h2>

          {/* Agent status badge */}
          {agentStatus && (
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                agentStatus === "running" && "bg-primary/10 text-primary",
                agentStatus === "queued" && "bg-muted text-muted-foreground",
                agentStatus === "done" && "bg-success/10 text-success",
                agentStatus === "failed" && "bg-destructive/10 text-destructive",
                !["running", "queued", "done", "failed"].includes(agentStatus) && "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  agentStatus === "running" && "bg-primary animate-pulse",
                  agentStatus === "queued" && "bg-muted-foreground",
                  agentStatus === "done" && "bg-success",
                  agentStatus === "failed" && "bg-destructive",
                )}
              />
              {agentStatus === "running"
                ? "Agent working"
                : agentStatus === "queued"
                  ? "In queue"
                  : agentStatus === "done"
                    ? "Complete"
                    : agentStatus === "failed"
                      ? "Failed"
                      : agentStatus}
            </span>
          )}

          {/* Timer */}
          <div className="mt-3 font-mono text-xs text-muted-foreground">
            Elapsed: {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
            ~{displayProgress}% complete
          </p>

          {/* Stage Progress Indicators */}
          <div className="mt-5 w-full max-w-md">
            <div className="flex justify-between items-center gap-1">
              {buildStages.map((stage, idx) => {
                const isComplete = displayProgress >= stage.progress
                const isCurrent = stage.id === currentStage.id
                return (
                  <div key={stage.id} className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500",
                        isComplete
                          ? "bg-primary text-primary-foreground scale-100"
                          : "bg-muted text-muted-foreground scale-90",
                        isCurrent && "ring-4 ring-primary/30 animate-pulse"
                      )}
                    >
                      {isComplete ? (stage.id < currentStage.id ? "✓" : stage.icon) : stage.id}
                    </div>
                    {idx < buildStages.length - 1 && (
                      <div className="absolute left-0 right-0 h-0.5 top-4 -z-10 hidden sm:block" style={{ width: `calc(100% / ${buildStages.length})`, marginLeft: `${(idx + 0.5) * (100 / buildStages.length)}%` }}>
                        <div className={cn("h-full transition-all duration-500", isComplete ? "bg-primary" : "bg-muted")} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1 text-[9px] text-muted-foreground text-center">
              {buildStages.map((stage) => (
                <div key={stage.id} className={cn("transition-colors", stage.id === currentStage.id && "text-primary font-semibold")}>
                  {stage.name.split(" ")[0]}
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-400">
            ⚠️ Please don&apos;t close this window or refresh — your build is in progress.
          </div>
        </div>
      </div>

      {/* Team Activity Panel - NEW */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inset-0 motion-safe:animate-ping rounded-full bg-primary/70" />
            <span className="relative size-2 rounded-full bg-primary" />
          </span>
          Teams at work
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {buildStages.filter(stage =>
            displayProgress >= stage.progress && displayProgress < (buildStages[buildStages.indexOf(stage) + 1]?.progress ?? 100)
          ).concat(
            buildStages.filter(stage =>
              displayProgress >= stage.progress - 15 && stage.id !== currentStage.id
            ).slice(0, 1)
          ).map((stage) => (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg p-3 transition-all",
                stage.id === currentStage.id
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-muted/40"
              )}
            >
              <span className={cn("text-2xl", stage.id === currentStage.id && "animate-pulse")}>
                {stage.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {stage.team}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {stage.id === currentStage.id ? "Working now" : "Recently active"}
                </p>
              </div>
              {stage.id === currentStage.id && (
                <div className="size-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent build events from the server */}
      {recentEvents.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            📋 Build log
          </p>
          <div className="flex flex-col gap-1.5">
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs",
                  evt.level === "error"
                    ? "bg-destructive/10 text-destructive"
                    : evt.level === "warn"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-muted/40 text-foreground",
                )}
              >
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {evt.stage}
                </span>
                <span className="leading-relaxed">{evt.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fun content while waiting */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {showFunFact ? "🤯 Fun fact" : "😄 While you wait"}
          </p>
          <p className="min-h-[3rem] text-sm leading-relaxed text-foreground transition-opacity duration-500">
            {showFunFact ? FUN_FACTS[currentEncouragement % FUN_FACTS.length] : ENCOURAGEMENTS[currentEncouragement]}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            💪 Did you know?
          </p>
          <p className="min-h-[3rem] text-sm leading-relaxed text-foreground transition-opacity duration-500">
            {FUN_FACTS[(currentEncouragement + 3) % FUN_FACTS.length]}
          </p>
        </div>
      </div>
    </div>
  )
}
