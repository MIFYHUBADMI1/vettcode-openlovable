"use client"

import Link from "next/link"
import {
  LayoutDashboard, Code2, ScrollText, PenLine,
  Database, Download, ExternalLink, KeyRound, BookOpen, FolderTree, FileArchive,
} from "lucide-react"
import { GitHubScrollButton } from "@/components/github-scroll-button"
import type { Project } from "@/lib/types/project"

interface ProjectActionsProps {
  project: Project
  isBuilt: boolean
}

export function ProjectActions({ project, isBuilt }: ProjectActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">

      {/* View Plan */}
      {project.specification && (
        <Link
          href={`/project/${project.id}/plan`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
        >
          <ScrollText className="size-3.5" />
          View plan
        </Link>
      )}

      {/* Collaborate — shown when plan is ready for review */}
      {project.specification && project.state === "plan_ready" && (
        <Link
          href={`/project/${project.id}/collaborate`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/20"
        >
          ✨ Review plan
        </Link>
      )}

      {/* Edit plan */}
      <Link
        href={`/project/${project.id}/edit`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/20"
      >
        <PenLine className="size-3.5" />
        Edit plan
      </Link>

      {/* Source code — only when built */}
      {isBuilt && (
        <Link
          href={`/project/${project.id}/source`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
        >
          <Code2 className="size-3.5" />
          Source code
        </Link>
      )}

      {/* Database — only when built */}
      {isBuilt && (
        <Link
          href={`/project/${project.id}/database`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 transition-all hover:bg-emerald-500/20 dark:text-emerald-400"
        >
          <Database className="size-3.5" />
          Database
        </Link>
      )}

      {/* Environment variables — only when built */}
      {isBuilt && (
        <Link
          href={`/project/${project.id}/env`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 transition-all hover:bg-amber-500/20 dark:text-amber-400"
        >
          <KeyRound className="size-3.5" />
          .env
        </Link>
      )}

      {/* README — GitHub mode only */}
      {project.githubReadme && (
        <Link
          href={`/project/${project.id}/readme`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-600 transition-all hover:bg-purple-500/20 dark:text-purple-400"
        >
          <BookOpen className="size-3.5" />
          README
        </Link>
      )}

      {/* App Tree — GitHub mode only */}
      {project.githubFileTree && (
        <Link
          href={`/project/${project.id}/tree`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-600 transition-all hover:bg-green-500/20 dark:text-green-400"
        >
          <FolderTree className="size-3.5" />
          App Tree
        </Link>
      )}

      {/* Repo Code — GitHub extend mode only */}
      {project.githubZipUrl && (
        <Link
          href={`/project/${project.id}/repo-code`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 transition-all hover:bg-amber-500/20 dark:text-amber-400"
        >
          <FileArchive className="size-3.5" />
          Repo Code
        </Link>
      )}

      {/* GitHub — scroll to section */}
      <GitHubScrollButton />

      {/* Open live preview — only when built */}
      {project.developmentUrl && (
        <a
          href={project.developmentUrl.startsWith("http") ? project.developmentUrl : `https://${project.developmentUrl}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-600 transition-all hover:bg-green-500/20 dark:text-green-400"
        >
          <ExternalLink className="size-3.5" />
          Open preview
        </a>
      )}

      {/* Export */}
      <a
        href={`/api/projects/${project.id}/export`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
      >
        <Download className="size-3.5" />
        Export
      </a>
    </div>
  )
}

export function DashboardLink({ projectId }: { projectId: string }) {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
    >
      <LayoutDashboard className="size-3.5" />
      Dashboard
    </Link>
  )
}
