"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { useProjects } from "@/lib/client/api"
import type { ProjectState } from "@/lib/types/project"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "mirrorsite:checklist-dismissed"

const PAST_ANALYSIS: ReadonlySet<ProjectState> = new Set([
  "analysis_complete",
  "specification_ready",
  "awaiting_build_confirmation",
  "building",
  "build_complete",
  "build_failed",
  "ready",
  "deploying",
  "deployed",
  "deployment_failed",
])

const PAST_BUILD: ReadonlySet<ProjectState> = new Set([
  "building",
  "build_complete",
  "build_failed",
  "ready",
  "deploying",
  "deployed",
  "deployment_failed",
])

export function OnboardingChecklist() {
  const { projects, isLoading } = useProjects()
  const [dismissed, setDismissed] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  const steps = [
    { label: "Create a project", done: projects.length > 0 },
    { label: "Get an analysis and build plan", done: projects.some((p) => PAST_ANALYSIS.has(p.state)) },
    { label: "Start a build", done: projects.some((p) => PAST_BUILD.has(p.state)) },
    { label: "Ship it", done: projects.some((p) => p.state === "deployed") },
  ]
  const doneCount = steps.filter((step) => step.done).length
  const allDone = doneCount === steps.length

  useEffect(() => {
    if (!allDone || dismissed) return
    const timer = window.setTimeout(() => {
      setFadingOut(true)
      window.setTimeout(() => {
        try {
          window.localStorage.setItem(STORAGE_KEY, "1")
        } catch {
          // ignore
        }
        setDismissed(true)
      }, 500)
    }, 2600)
    return () => window.clearTimeout(timer)
  }, [allDone, dismissed])

  if (isLoading || dismissed) return null

  return (
    <div
      className={cn(
        "border border-border bg-card p-5 transition-opacity duration-500",
        fadingOut ? "opacity-0" : "opacity-100",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Getting started</p>
        <p className="font-mono text-xs text-muted-foreground">
          {doneCount}/{steps.length}
        </p>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                step.done
                  ? "border-success/40 bg-success/15 text-success"
                  : "border-border bg-muted text-transparent",
              )}
            >
              <Check className="size-3" />
            </span>
            <span className={cn("text-sm", step.done ? "text-muted-foreground line-through" : "text-foreground")}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
