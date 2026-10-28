"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { ExternalLink, Minimize2, RefreshCw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn, ensureProtocol } from "@/lib/utils"
import { postJson } from "@/lib/client/api"
import {
  BUILD_STAGES,
  BUILD_TEAM_NAMES,
  getStageMessage,
  getStageMessages,
  stageForServerStage,
  type BuildStage,
} from "@/lib/build-messages"

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

/** Rough wall-clock a build usually takes, used only for the estimated bar. */
const ESTIMATE_SECONDS = 300

const TEAM_TONE: Record<string, string> = {
  research: "bg-blue-400 text-blue-950",
  engineering: "bg-violet-400 text-violet-950",
  product: "bg-sky-400 text-sky-950",
  launch: "bg-amber-400 text-amber-950",
  cofounder: "bg-rose-400 text-rose-950",
}

function TeamChip({ stage, active }: { stage: BuildStage; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        active ? cn(TEAM_TONE[stage.team], "motion-safe:animate-pulse") : "bg-muted text-muted-foreground",
      )}
    >
      {BUILD_TEAM_NAMES[stage.team]}
      <span className="font-normal opacity-80">· {stage.subteam}</span>
    </span>
  )
}

interface BuildStageOverlayProps {
  projectId: string
  projectName?: string
  projectPurpose?: string
  sourceUrl?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRetry?: () => void
  onFinished?: () => void
}

export function BuildStageOverlay({
  projectId,
  projectName,
  projectPurpose,
  sourceUrl,
  open,
  onOpenChange,
  onRetry,
  onFinished,
}: BuildStageOverlayProps) {
  const [elapsed, setElapsed] = useState(0)
  const [beat, setBeat] = useState(0)
  const [phase, setPhase] = useState<"working" | "success" | "failed">("working")
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const { data } = useSWR<{ ok: boolean; data: StatusResponse }>(
    open ? `/api/projects/${projectId}/status` : null,
    jsonFetcher,
    { refreshInterval: phase === "working" ? 3000 : 0, keepPreviousData: true },
  )
  const status = data?.data

  useEffect(() => {
    if (!open) {
      setElapsed(0)
      setBeat(0)
      setPhase("working")
      setRetryError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || phase !== "working") return
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(timer)
  }, [open, phase])

  useEffect(() => {
    if (!open || phase !== "working") return
    const timer = setInterval(() => setBeat((b) => b + 1), 6500)
    return () => clearInterval(timer)
  }, [open, phase])

  useEffect(() => {
    if (status?.state === "ready" || status?.state === "deployed" || status?.state === "build_complete") {
      setPhase("success")
    } else if (status?.state === "build_failed" || status?.state === "deployment_failed") {
      setPhase("failed")
    }
  }, [status?.state])

  useEffect(() => {
    if (phase !== "success") return
    const timer = setTimeout(() => {
      onOpenChange(false)
      onFinished?.()
    }, 4000)
    return () => clearTimeout(timer)
  }, [phase, onFinished, onOpenChange])

  const ctx = useMemo(() => ({ projectName, projectPurpose, sourceUrl }), [projectName, projectPurpose, sourceUrl])

  const realProgress = typeof status?.progress === "number" ? status.progress : null
  const progress = realProgress ?? Math.min(95, Math.floor((elapsed / ESTIMATE_SECONDS) * 100))

  // The build log is the truth about which stage the squads are in; the progress
  // number (and the elapsed clock) only fill in when no event has landed.
  const stage: BuildStage = useMemo(() => {
    const events = status?.events ?? []
    return stageForServerStage(events.length ? events[events.length - 1]?.stage : undefined, progress)
  }, [status?.events, progress])

  const stageIndex = BUILD_STAGES.findIndex((s) => s.id === stage.id)

  const headline = getStageMessage(stage.id, beat, ctx)
  const updates = useMemo(() => {
    const pool = getStageMessages(stage.id, ctx)
    if (!pool.length) return []
    return [0, 1, 2].map((offset) => pool[(beat + offset + 1) % pool.length])
  }, [beat, ctx, stage.id])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  const handleRetry = useCallback(async () => {
    setRetryError(null)
    if (onRetry) {
      onRetry()
      return
    }
    setRetrying(true)
    try {
      await postJson(`/api/projects/${projectId}/build`, {})
      setPhase("working")
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : "Could not restart the build")
    } finally {
      setRetrying(false)
    }
  }, [onRetry, projectId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl" showCloseButton={phase !== "working"}>
        {phase === "success" ? (
          <div className="relative flex flex-col items-center py-6 text-center">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute animate-confetti rounded-full motion-reduce:hidden"
                  style={{
                    left: `${10 + (i * 7) % 80}%`,
                    top: "-5%",
                    width: `${4 + (i % 3) * 2}px`,
                    height: `${4 + (i % 3) * 2}px`,
                    backgroundColor: i % 3 === 0 ? "hsl(var(--primary))" : i % 3 === 1 ? "hsl(var(--success))" : "hsl(var(--chart-4))",
                    ["--delay" as string]: `${i * 0.15}s`,
                    ["--duration" as string]: `${1.5 + (i % 3) * 0.5}s`,
                  }}
                />
              ))}
            </div>
            <div className="flex size-16 items-center justify-center rounded-full bg-success/15 ring-4 ring-success/20">
              <svg className="size-9 text-success animate-check-draw motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 13l4 4L19 7" className="animate-check-stroke" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-semibold text-success">It&apos;s live</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              The teams handed {projectName ?? "your application"} over. Opening your workspace now.
            </p>
            {status?.developmentUrl ? (
              <a
                href={ensureProtocol(status.developmentUrl)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-success-foreground hover:bg-success/90"
              >
                Open preview
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
        ) : phase === "failed" ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/20">
              <svg className="size-9 text-destructive animate-fail-shake motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12" className="animate-x-draw" />
                <path d="M18 6L6 18" className="animate-x-draw" style={{ animationDelay: "0.15s" }} />
              </svg>
            </div>
            <p className="mt-4 text-lg font-semibold text-destructive">The build stopped</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {status?.message || "Something broke on the line. Your credits were refunded and nothing you entered was lost."}
            </p>
            {retryError ? <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{retryError}</p> : null}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={handleRetry} disabled={retrying}>
                <RefreshCw className={cn("size-4", retrying && "motion-safe:animate-spin")} aria-hidden />
                {retrying ? "Restarting…" : "Build again"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Back to workspace</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Your team is on it</DialogTitle>
              <DialogDescription>
                {projectName ?? "Your application"} is in production. Watch the squads work through each stage below.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
              <strong className="font-semibold">Keep this tab open</strong> — the build runs in your browser session. Minimising is fine; closing the tab or refreshing stops it and costs a restart.
            </div>

            <div className="flex items-center gap-2" role="img" aria-label={`Stage ${stageIndex + 1} of ${BUILD_STAGES.length}: ${stage.name}`}>
              {BUILD_STAGES.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-500",
                    i < stageIndex && "bg-primary/50",
                    i === stageIndex && "bg-primary motion-safe:animate-pulse",
                    i > stageIndex && "bg-muted",
                  )}
                />
              ))}
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl ring-4 ring-primary/15 motion-safe:animate-bounce" style={{ animationDuration: "2.4s" }} aria-hidden>
                  {stage.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Stage {stageIndex + 1} of {BUILD_STAGES.length}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{stage.name}</p>
                  <div className="mt-1.5">
                    <TeamChip stage={stage} active />
                  </div>
                </div>
              </div>
              <p key={headline} className="mt-3 min-h-[2.5rem] text-sm leading-6 text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500 motion-reduce:animate-none">
                {headline}
              </p>
            </div>

            <ol className="flex flex-col gap-1.5">
              {BUILD_STAGES.map((s, i) => {
                const done = i < stageIndex
                const current = i === stageIndex
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors",
                      current ? "border-primary/40 bg-primary/5" : "border-transparent",
                      done && "opacity-70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        done ? "bg-primary/20 text-primary" : current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {done ? "✓" : s.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-medium", current ? "text-foreground" : "text-muted-foreground")}>{s.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{s.activity}</span>
                    </span>
                    <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground sm:block">
                      {BUILD_TEAM_NAMES[s.team]}
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Team updates</p>
              <ul className="mt-2 flex flex-col gap-2">
                {updates.map((line, i) => (
                  <li key={line} className={cn("flex gap-2 text-xs leading-5 text-muted-foreground", i === 0 && "text-foreground")}>
                    <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", i === 0 ? "bg-primary motion-safe:animate-pulse" : "bg-muted-foreground/40")} aria-hidden />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
                <span>{realProgress !== null ? `${progress}%` : `~${progress}% (est.)`}</span>
                <span>Elapsed {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>
                <button type="button" onClick={() => onOpenChange(false)} className="inline-flex items-center gap-1 text-foreground hover:underline">
                  <Minimize2 className="size-3" aria-hidden />
                  Minimise
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
