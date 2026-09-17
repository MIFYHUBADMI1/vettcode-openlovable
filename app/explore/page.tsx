"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { toast } from "sonner"

interface ExploreProject {
  id: string
  name: string
  mode: string
  state: string
  sourceUrl: string | null
  purpose: string | null
  thumbnailUrl: string | null
  productionUrl: string | null
  likeCount: number
  forkCount: number
  liked: boolean
  createdAt: number
  updatedAt: number
  author: {
    id: string
    name: string
    email: string
    imageUrl: string | null
    following: boolean
    isCurrentUser: boolean
  } | null
}

interface ExploreResponse {
  projects: ExploreProject[]
  total: number
  page: number
  pages: number
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function authorInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

function ProjectCard({ project, onLikeToggle, onFollowToggle, onFork }: {
  project: ExploreProject
  onLikeToggle: (id: string) => void
  onFollowToggle: (authorId: string) => void
  onFork: (id: string) => void
}) {
  const [forking, setForking] = useState(false)
  const [likePending, setLikePending] = useState(false)
  const [followPending, setFollowPending] = useState(false)

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault()
    if (likePending) return
    setLikePending(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/like`, { method: "POST" })
      if (res.status === 401) { toast.error("Sign in to like projects"); return }
      if (!res.ok) { const d = await res.json(); toast.error(d.message || "Failed"); return }
      onLikeToggle(project.id)
    } finally {
      setLikePending(false)
    }
  }

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault()
    if (!project.author || followPending) return
    setFollowPending(true)
    try {
      const res = await fetch(`/api/users/${project.author.id}/follow`, { method: "POST" })
      if (res.status === 401) { toast.error("Sign in to follow users"); return }
      if (!res.ok) { const d = await res.json(); toast.error(d.message || "Failed"); return }
      onFollowToggle(project.author.id)
    } finally {
      setFollowPending(false)
    }
  }

  async function handleFork(e: React.MouseEvent) {
    e.preventDefault()
    if (forking) return
    setForking(true)
    try {
      const res = await fetch(`/api/projects/${project.id}/fork`, { method: "POST" })
      if (res.status === 401) { toast.error("Sign in to fork projects"); return }
      const data = await res.json()
      if (!res.ok) { toast.error(data.message || "Fork failed"); return }
      if (data.data.alreadyForked) {
        toast.info("You already forked this project")
      } else {
        toast.success("Project forked! Opening your workspace…")
        onFork(project.id)
        setTimeout(() => window.location.href = `/project/${data.data.project.id}`, 1200)
      }
    } finally {
      setForking(false)
    }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-accent/50 hover:shadow-md">
      {/* Thumbnail */}
      <Link href={`/public/${project.id}`} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent/20">
              <span className="font-mono text-2xl text-muted-foreground/40">
                {project.mode === "scratch" ? "✦" : "⬡"}
              </span>
            </div>
          )}
          {/* Live badge */}
          {project.productionUrl && (
            <span className="absolute right-2 top-2 rounded-full bg-green-500/90 px-2 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur">
              Live
            </span>
          )}
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Title + purpose */}
        <Link href={`/public/${project.id}`} className="flex flex-col gap-1">
          <h2 className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {project.name}
          </h2>
          {project.purpose && (
            <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
              {project.purpose}
            </p>
          )}
        </Link>

        {/* Author row */}
        {project.author && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary overflow-hidden">
                {project.author.imageUrl ? (
                  <img src={project.author.imageUrl} alt={project.author.name} className="h-full w-full object-cover" />
                ) : (
                  authorInitials(project.author.name)
                )}
              </div>
              <span className="truncate text-xs text-muted-foreground">{project.author.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground/50">·</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">{timeAgo(project.updatedAt)}</span>
            </div>
            {!project.author.isCurrentUser && (
              <button
                onClick={handleFollow}
                disabled={followPending}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${project.author.following
                    ? "bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
              >
                {project.author.following ? "Following" : "Follow"}
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          {/* Like — hidden on own projects */}
          {!project.author?.isCurrentUser && (
            <button
              onClick={handleLike}
              disabled={likePending}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${project.liked
                  ? "text-red-500 hover:text-red-600"
                  : "text-muted-foreground hover:text-red-500"
                }`}
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill={project.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>{project.likeCount}</span>
            </button>
          )}
          {/* Like count only on own projects */}
          {project.author?.isCurrentUser && project.likeCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
              <svg className="size-3.5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {project.likeCount}
            </span>
          )}

          {/* Fork */}
          <button
            onClick={handleFork}
            disabled={forking}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            {forking ? (
              <span className="size-3.5 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9M12 15v-3" />
              </svg>
            )}
            <span>{forking ? "Forking…" : "Fork"}</span>
          </button>

          {/* View live */}
          {project.productionUrl && (
            <a
              href={project.productionUrl}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/10 dark:text-green-400"
            >
              <span>Open</span>
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

export default function ExplorePage() {
  const router = useRouter()
  const [data, setData] = useState<ExploreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sort, setSort] = useState("recent")
  const [page, setPage] = useState(1)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, page: String(page) })
      if (debouncedSearch) params.set("q", debouncedSearch)
      const res = await fetch(`/api/explore?${params}`)
      const json = await res.json()
      if (json.ok) setData(json.data)
    } catch {
      toast.error("Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, sort, page])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  function handleLikeToggle(projectId: string) {
    setData(prev => prev ? {
      ...prev,
      projects: prev.projects.map(p =>
        p.id === projectId
          ? { ...p, liked: !p.liked, likeCount: p.liked ? p.likeCount - 1 : p.likeCount + 1 }
          : p
      ),
    } : prev)
  }

  function handleFollowToggle(authorId: string) {
    setData(prev => prev ? {
      ...prev,
      projects: prev.projects.map(p =>
        p.author?.id === authorId
          ? { ...p, author: { ...p.author!, following: !p.author!.following } }
          : p
      ),
    } : prev)
  }

  function handleFork(_projectId: string) {
    // Optimistic — the redirect happens in the card component
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">

        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse apps built by the community — like, follow, or fork into your workspace
            </p>
          </div>
          {data && (
            <p className="font-mono text-xs text-muted-foreground">
              {data.total.toLocaleString()} public project{data.total !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Search + sort bar */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search projects…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2">
            {(["recent", "popular", "forked"] as const).map(s => (
              <button
                key={s}
                onClick={() => { setSort(s); setPage(1) }}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors capitalize ${sort === s
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:bg-accent"
                  }`}
              >
                {s === "recent" ? "Newest" : s === "popular" ? "Most liked" : "Most forked"}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                <div className="aspect-[16/9] w-full animate-pulse bg-muted" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : data?.projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <svg className="size-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">No projects found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {debouncedSearch ? `No results for "${debouncedSearch}"` : "Be the first to publish a project!"}
              </p>
            </div>
            {debouncedSearch && (
              <button onClick={() => setSearch("")} className="text-sm text-primary hover:underline">
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data!.projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onLikeToggle={handleLikeToggle}
                onFollowToggle={handleFollowToggle}
                onFork={handleFork}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, data.pages) }).map((_, i) => {
                const p = data.pages <= 7
                  ? i + 1
                  : page <= 4 ? i + 1
                    : page >= data.pages - 3 ? data.pages - 6 + i
                      : page - 3 + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`size-9 rounded-lg text-sm font-medium transition-colors ${p === page
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card text-muted-foreground hover:bg-accent"
                      }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}

        {/* CTA for non-logged-in users */}
        <div className="mt-16 rounded-xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Share your own creation</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Build an app with Atai, publish it, and make it public to appear here
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Go to your workspace
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
