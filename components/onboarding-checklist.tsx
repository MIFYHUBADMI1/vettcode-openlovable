"use client"

import Link from "next/link"
import { Check } from "lucide-react"
import { useProjects } from "@/lib/client/api"
import type { ProjectState, ProjectSummary } from "@/lib/types/project"
import { cn } from "@/lib/utils"

const PLAN_STATES = new Set<ProjectState>([
  "analysis_complete",
  "specification_ready",
  "plan_ready",
  "awaiting_build_confirmation",
  "building",
  "build_complete",
  "build_failed",
  "ready",
  "deploying",
  "deployed",
  "deployment_failed",
])

const BUILD_STATES = new Set<ProjectState>([
  "building",
  "build_complete",
  "build_failed",
  "ready",
  "deploying",
  "deployed",
  "deployment_failed",
])

function stepsFor(project: ProjectSummary) {
  return [
    {
      id: "vision",
      label: "Tell Atai what you're building",
      done: true,
      href: `/project/${project.id}/collaborate`,
    },
    {
      id: "plan",
      label: "Shape the plan",
      done: PLAN_STATES.has(project.state),
      href: `/project/${project.id}/collaborate`,
    },
    {
      id: "build",
      label: "Build the product",
      done: BUILD_STATES.has(project.state),
      href: `/project/${project.id}`,
    },
    {
      id: "live",
      label: "Go live",
      done: project.state === "deployed",
      href: `/project/${project.id}`,
    },
  ]
}

export function OnboardingChecklist() {
  const { projects } = useProjects()
  const project = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  if (!project) return null

  const items = stepsFor(project)
  if (items.every((item) => item.done)) return null

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your first build</p>
      <h2 className="mt-2 text-lg font-semibold">{project.name}</h2>
      <ol className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-accent/50",
                item.done ? "text-muted-foreground" : "text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border",
                  item.done ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600" : "border-border",
                )}
              >
                {item.done ? <Check className="size-3" /> : null}
              </span>
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
