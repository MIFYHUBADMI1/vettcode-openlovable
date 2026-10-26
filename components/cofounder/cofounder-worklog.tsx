"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CofounderWorklogStep {
  label: string
  detail?: string
}

export type CofounderWorklogSurface = "plan" | "workspace"

/** Seconds at which each step becomes the active one. The last step keeps
 * running until the response lands, no matter how long the model takes. */
const STEP_AT_SECONDS = [0, 3, 6.4, 9.8, 13.2]

function quoteMessage(message: string): string {
  const ask = message.replace(/\s+/g, " ").trim()
  return ask.length > 72 ? `${ask.slice(0, 71).trimEnd()}…` : ask
}

/** The final drafting step names what the model is actually being asked to
 * do, so the checklist reads like it belongs to this message. */
function draftStepLabel(message: string, surface: CofounderWorklogSurface): { label: string; detail: string } {
  if (/\b(gap|missing|overlook)/i.test(message)) {
    return { label: "Mapping what is missing", detail: "Checking the plan for holes before they reach the build" }
  }
  if (/\b(challenge|assumption|risk)/i.test(message)) {
    return { label: "Stress-testing your assumptions", detail: "Pushing on the claims that would hurt most if they are wrong" }
  }
  if (/\b(business model|revenue|pricing|monetiz|monetis)/i.test(message)) {
    return { label: "Pressure-testing the business model", detail: "Following the money from value created to value captured" }
  }
  if (/\b(next|priority|first step)/i.test(message)) {
    return { label: "Ranking what to do next", detail: "Weighing urgency against what actually unblocks progress" }
  }
  if (/\b(improve|stronger|better)/i.test(message)) {
    return { label: "Finding the highest-leverage upgrade", detail: "Looking for the one change that lifts the rest of the plan" }
  }
  if (surface === "workspace") {
    if (/\b(open|go to|take me|navigate|jump)/i.test(message)) {
      return { label: "Finding where that lives", detail: "Resolving the safest route to the right screen" }
    }
    if (/\b(build|deploy|launch|create|fix|change|update)/i.test(message)) {
      return { label: "Preparing a reviewable action", detail: "Nothing consequential runs without your approval" }
    }
  }
  return { label: "Shaping a recommendation", detail: "Weighing the tradeoffs before committing to an answer" }
}

export function buildCofounderWorklogSteps({
  message,
  section = null,
  surface = "workspace",
}: {
  message: string
  section?: string | null
  surface?: CofounderWorklogSurface
}): CofounderWorklogStep[] {
  const draft = draftStepLabel(message, surface)
  const plan = surface === "plan"
  return [
    { label: "Reading your message", detail: `“${quoteMessage(message)}”` },
    section
      ? { label: `Opening ${section}`, detail: "Loading the section, its dependencies, and what is already filled in" }
      : plan
        ? { label: "Loading your whole plan", detail: "Every section, your decisions, and the conversation so far" }
        : { label: "Pulling in your workspace", detail: "Your projects, plans, and the conversation so far" },
    plan
      ? { label: "Cross-checking your decisions", detail: "Looking for contradictions, gaps, and assumptions worth challenging" }
      : { label: "Connecting it to your work", detail: "Matching your ask to the project and screen you are on" },
    draft,
    plan
      ? { label: "Checking for plan changes", detail: "Any edit comes back for your approval before it is applied" }
      : { label: "Checking for actions to take", detail: "Anything consequential still needs your approval first" },
  ]
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${rest.toString().padStart(2, "0")}`
}

/**
 * Staged execution panel shown while the co-founder is responding.
 *
 * The server answers in one request, so these are pacing labels for work the
 * request genuinely performs (load context → weigh it → draft → check for a
 * proposal), not invented telemetry. They give the founder a roadmap to watch
 * instead of an indeterminate "thinking…" bubble.
 */
export function CofounderWorklog({
  steps,
  active,
  className,
}: {
  steps: CofounderWorklogStep[]
  active: boolean
  className?: string
}) {
  const startedAt = useRef(Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!active) return
    const tick = () => setElapsedMs(Date.now() - startedAt.current)
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [active])

  // Freeze the finished duration on the last tick instead of whatever the
  // interval last sampled.
  useEffect(() => {
    if (active) return
    setElapsedMs(Date.now() - startedAt.current)
  }, [active])

  const elapsed = elapsedMs / 1000
  const current = active
    ? Math.min(steps.length - 1, STEP_AT_SECONDS.filter((at) => elapsed >= at).length - 1)
    : steps.length - 1
  const progress = active ? Math.min(94, 8 + 86 * (1 - Math.exp(-elapsed / 26))) : 100
  const slow = active && elapsed > 22

  return (
    <div
      className={cn(
        "cofounder-worklog relative overflow-hidden rounded-2xl border border-border bg-card/70 p-3.5 sm:p-4",
        className,
      )}
    >
      <span
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        aria-hidden
      />
      <div className="flex items-center gap-3">
        <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          {active ? (
            <>
              <span className="cofounder-ping absolute inset-0 rounded-full border border-primary/40" aria-hidden />
              <Loader2 className="size-4 animate-spin" aria-hidden />
            </>
          ) : (
            <Check className="size-4" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {active ? (slow ? "Still going — being thorough" : "Your co-founder is on it") : "Here is my take"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {active ? steps[current]?.label : "Ready when you are"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatElapsed(elapsed)}
        </span>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            "cofounder-progress h-full rounded-full bg-gradient-to-r from-primary/80 to-primary",
            active && "cofounder-progress-live",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {active ? steps[current]?.label : "Your co-founder has finished."}
      </p>
      <ol className="mt-3">
        {steps.map((step, index) => {
          const done = !active || index < current
          const isActive = active && index === current
          return (
            <li
              key={step.label}
              className="cofounder-step-in relative flex gap-2.5 pb-3 last:pb-0"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    "absolute left-[7px] top-6 h-[calc(100%-20px)] w-px transition-colors duration-500",
                    done ? "bg-primary/30" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
              <span
                className={cn(
                  "relative mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                  done || isActive ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background",
                )}
                aria-hidden
              >
                {done ? (
                  <Check className="size-2.5" />
                ) : isActive ? (
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                ) : (
                  <span className="size-1 rounded-full bg-muted-foreground/30" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs leading-4 transition-colors duration-300",
                    isActive ? "font-medium text-foreground" : done ? "text-foreground/80" : "text-muted-foreground/60",
                  )}
                >
                  {step.label}
                </p>
                {step.detail ? (
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-4",
                      isActive ? "text-muted-foreground" : "text-muted-foreground/55",
                    )}
                  >
                    {isActive && slow ? "Still working — detailed answers take a moment." : step.detail}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
