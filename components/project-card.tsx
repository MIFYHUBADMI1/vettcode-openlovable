"use client"

import { useState } from "react"
import Link from "next/link"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ProjectSummary } from "@/lib/types/project"
import { StateBadge } from "@/components/state-badge"
import { deleteJson } from "@/lib/client/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function relativeTime(value: string | number): string {
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ""
  const diff = Date.now() - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export function ProjectCard({ project, onDeleted }: { project: ProjectSummary; onDeleted?: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const title = project.sourceUrl ? hostOf(String(project.sourceUrl)) : project.name
  const subtitle = project.sourceUrl ?? "Built from scratch"

  async function handleDelete() {
    setDeleting(true)
    console.log("[v0] project-card: delete requested", { id: project.id })
    try {
      await deleteJson(`/api/projects/${project.id}`)
      console.log("[v0] project-card: delete succeeded", { id: project.id })
      toast.success("Project deleted")
      setDialogOpen(false)
      onDeleted?.()
    } catch (e) {
      console.log("[v0] project-card: delete failed", { id: project.id, error: (e as Error).message })
      toast.error((e as Error).message || "Failed to delete project")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="group relative flex flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/50">
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger
          aria-label="Delete project"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-medium text-foreground">{title}</span> and its entire
              build history. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link href={`/project/${project.id}`} className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-mono text-sm font-medium text-foreground">{title}</span>
            <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
          </div>
          <StateBadge state={project.state} />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="font-mono text-xs text-muted-foreground">{relativeTime(project.updatedAt)}</span>
          <span className="font-mono text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
            Open &rarr;
          </span>
        </div>
      </Link>
    </div>
  )
}
