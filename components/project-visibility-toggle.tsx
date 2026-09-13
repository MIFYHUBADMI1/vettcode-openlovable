"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { Project } from "@/lib/types/project"

export function ProjectVisibilityToggle({ project }: { project: Project }) {
  const [visibility, setVisibility] = useState<"private" | "public">(project.visibility || "private")
  const [loading, setLoading] = useState(false)

  const hasDeployment = project.deploymentHistory?.some(d => d.status === "success")
  const isBuilt = ["ready", "build_complete", "deploying", "deployed"].includes(project.state)
  const canBePublic = isBuilt
  const isPublic = visibility === "public"

  async function toggleVisibility() {
    if (!canBePublic && !isPublic) {
      toast.error("Deploy your project first to make it public")
      return
    }

    const newVisibility = isPublic ? "private" : "public"
    setLoading(true)

    try {
      const res = await fetch(`/api/projects/${project.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: newVisibility }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.message || "Failed to update visibility")
        return
      }

      setVisibility(newVisibility)
      toast.success(data.message)
    } catch (e) {
      toast.error((e as Error).message || "Failed to update visibility")
    } finally {
      setLoading(false)
    }
  }

  const publicUrl = isPublic ? `${typeof window !== "undefined" ? window.location.origin : ""}/public/${project.id}` : null

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-medium uppercase tracking-widest text-foreground">
              Project Visibility
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isPublic
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-muted text-muted-foreground"
                }`}
            >
              {isPublic ? "Public" : "Private"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPublic
              ? "Anyone with the link can view this project"
              : "Only you can view this project"}
          </p>
          {!canBePublic && !isPublic && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Build your project first to make it public
            </p>
          )}
        </div>

        <button
          onClick={toggleVisibility}
          disabled={loading || (!canBePublic && !isPublic)}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isPublic
            ? "border border-border bg-card hover:bg-accent"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
            } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {loading ? "Updating..." : isPublic ? "Make private" : "Make public"}
        </button>
      </div>

      {isPublic && publicUrl && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">Public Link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs text-foreground">
              {publicUrl}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(publicUrl)
                toast.success("Link copied to clipboard")
              }}
              className="shrink-0 rounded px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
