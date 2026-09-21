"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  Code2,
  ScrollText,
  PenLine,
  Database,
  Download,
  ExternalLink,
  KeyRound,
  BookOpen,
  FolderTree,
  FileArchive,
  Activity,
  Sparkles,
} from "lucide-react"
import { GitHubScrollButton } from "@/components/github-scroll-button"
import type { Project } from "@/lib/types/project"
import { cn } from "@/lib/utils"

interface ProjectActionsProps {
  project: Project
  isBuilt: boolean
}

function Tool({
  href,
  icon: Icon,
  children,
  tone = "default",
  external,
}: {
  href: string
  icon: typeof ScrollText
  children: ReactNode
  tone?: "default" | "accent" | "success" | "warn" | "violet"
  external?: boolean
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
    tone === "default" && "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-foreground",
    tone === "accent" && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
    tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400",
    tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400",
    tone === "violet" && "border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-400",
  )
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        <Icon className="size-3.5" />
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className}>
      <Icon className="size-3.5" />
      {children}
    </Link>
  )
}

export function ProjectActions({ project, isBuilt }: ProjectActionsProps) {
  const previewHref = project.developmentUrl
    ? project.developmentUrl.startsWith("http")
      ? project.developmentUrl
      : `https://${project.developmentUrl}`
    : null

  return (
    <nav aria-label="Workspace tools" className="-mx-1 flex gap-2 overflow-x-auto pb-1">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        {project.specification ? (
          <Tool href={`/project/${project.id}/plan`} icon={ScrollText}>
            View plan
          </Tool>
        ) : null}
        {project.specification && project.state === "plan_ready" ? (
          <Tool href={`/project/${project.id}/collaborate`} icon={Sparkles} tone="accent">
            Review plan
          </Tool>
        ) : null}
        <Tool href={`/project/${project.id}/edit`} icon={PenLine} tone="accent">
          Edit plan
        </Tool>
        {isBuilt ? (
          <Tool href={`/project/${project.id}/source`} icon={Code2}>
            Source
          </Tool>
        ) : null}
        <Tool href={`/project/${project.id}/runtime`} icon={Activity}>
          Runtime
        </Tool>
        {isBuilt ? (
          <Tool href={`/project/${project.id}/database`} icon={Database} tone="success">
            Database
          </Tool>
        ) : null}
        {isBuilt ? (
          <Tool href={`/project/${project.id}/env`} icon={KeyRound} tone="warn">
            .env
          </Tool>
        ) : null}
        {project.githubReadme ? (
          <Tool href={`/project/${project.id}/readme`} icon={BookOpen} tone="violet">
            README
          </Tool>
        ) : null}
        {project.githubFileTree ? (
          <Tool href={`/project/${project.id}/tree`} icon={FolderTree} tone="success">
            App tree
          </Tool>
        ) : null}
        {project.githubZipUrl ? (
          <Tool href={`/project/${project.id}/repo-code`} icon={FileArchive} tone="warn">
            Repo code
          </Tool>
        ) : null}
        <GitHubScrollButton />
        {previewHref ? (
          <Tool href={previewHref} icon={ExternalLink} tone="success" external>
            Preview
          </Tool>
        ) : null}
        <Tool href={`/api/projects/${project.id}/export`} icon={Download}>
          Export
        </Tool>
      </div>
    </nav>
  )
}

export function DashboardLink({ projectId }: { projectId: string }) {
  return (
    <Link
      href="/dashboard"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
    >
      <LayoutDashboard className="size-3.5" />
      Dashboard
    </Link>
  )
}
