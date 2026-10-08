"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/**
 * Project selector driving the whole portal: ?project=<id> is the single
 * source of state shared by Overview / Keys / Usage / Playground so every
 * tab stays on the same project.
 */
export function ProjectPicker({ projects }: { projects: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const current = params.get("project")

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="whitespace-nowrap">Project</span>
      <select
        aria-label="Select project"
        className="h-8 max-w-64 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
        value={current ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams()
          if (e.target.value) next.set("project", e.target.value)
          router.push(`${pathname}?${next.toString()}`)
        }}
      >
        <option value="" disabled>
          {projects.length === 0 ? "No projects" : "Choose a project…"}
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id} className={cn()}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
