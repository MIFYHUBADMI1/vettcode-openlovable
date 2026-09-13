import { notFound } from "next/navigation"
import Link from "next/link"
import { AppHeader } from "@/components/app-header"
import { store } from "@/lib/store/store"
import { ensureProtocol } from "@/lib/utils"
import { usersCol, projectLikesCol, userFollowsCol, projectsCol } from "@/lib/db/collections"
import { getCurrentUser } from "@/lib/auth/session"
import { PublicProjectActions } from "@/components/public-project-actions"

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function authorInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

export default async function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [project, currentUser] = await Promise.all([
    store.getProject(id).catch(() => null),
    getCurrentUser().catch(() => null),
  ])

  if (!project) notFound()
  if (project.visibility !== "public") notFound()

  // Latest successful deployment
  const latestDeploy = [...(project.deploymentHistory ?? [])].reverse().find(d => d.status === "success")
  const productionUrl = latestDeploy?.productionUrl ? ensureProtocol(latestDeploy.productionUrl) : null
  const customDomain = latestDeploy?.customDomain ? ensureProtocol(latestDeploy.customDomain) : null
  const liveUrl = customDomain || productionUrl
  const thumbnailUrl = project.understanding?.screenshots?.[0] ?? null
  const purpose = project.understanding?.purpose ?? null

  // Fetch author, like count, follow count, current user's like/follow status
  const [authorDoc, likeCount, followCount] = await Promise.all([
    (await usersCol()).findOne({ id: project.userId }, { projection: { id: 1, name: 1, email: 1, imageUrl: 1, createdAt: 1 } }),
    (await projectLikesCol()).countDocuments({ projectId: id }),
    (await userFollowsCol()).countDocuments({ followingId: project.userId }),
  ])

  let isLiked = false
  let isFollowing = false
  let alreadyForked = false
  if (currentUser) {
    const [likeDoc, followDoc, forkDoc] = await Promise.all([
      (await projectLikesCol()).findOne({ userId: currentUser.id, projectId: id }),
      (await userFollowsCol()).findOne({ followerId: currentUser.id, followingId: project.userId }),
      // check forks collection
      (await (await import("@/lib/db/collections")).projectForksCol()).findOne({ forkedByUserId: currentUser.id, originalProjectId: id }),
    ])
    isLiked = Boolean(likeDoc)
    isFollowing = Boolean(followDoc)
    alreadyForked = Boolean(forkDoc)
  }

  // Similar projects — same mode, also public, different project
  const col = await projectsCol()
  const similarProjects = await col.find({
    visibility: "public",
    id: { $ne: id },
    mode: project.mode,
  }).sort({ updatedAt: -1 }).limit(4).toArray()

  // Fork pricing for this project's complexity tier
  const { FORK_PRICING } = await import("@/lib/billing/config")
  const complexity = project.specification?.complexity ?? "simple"
  const forkTier = (complexity === "complex" ? "complex" : complexity === "medium" ? "medium" : "simple") as keyof typeof FORK_PRICING
  const forkPricing = FORK_PRICING[forkTier]

  const isOwner = currentUser?.id === project.userId

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />

      <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">

          {/* ── Main content ─────────────────────────────────── */}
          <div className="flex flex-1 flex-col gap-8 min-w-0">

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/explore" className="hover:text-foreground transition-colors">Explore</Link>
              <span>/</span>
              <span className="truncate text-foreground">{project.name}</span>
            </div>

            {/* Hero screenshot */}
            {thumbnailUrl ? (
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
                <img
                  src={thumbnailUrl}
                  alt={`Screenshot of ${project.name}`}
                  className="w-full object-cover object-top max-h-[560px] transition-transform duration-700 group-hover:scale-[1.01]"
                />
                {liveUrl && (
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/20 group-hover:opacity-100"
                  >
                    <span className="rounded-xl bg-white/90 px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-lg backdrop-blur">
                      Open live app ↗
                    </span>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-muted to-accent/20">
                <span className="font-mono text-5xl text-muted-foreground/30">
                  {project.mode === "scratch" ? "✦" : "⬡"}
                </span>
              </div>
            )}

            {/* Title + purpose */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400">
                  🌐 Public
                </span>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground capitalize">
                  {project.mode} mode
                </span>
                {liveUrl && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    🚀 Live
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{project.name}</h1>
              {purpose && (
                <p className="text-base leading-7 text-muted-foreground text-balance max-w-2xl">{purpose}</p>
              )}
            </div>

            {/* Live link banner */}
            {liveUrl && (
              <div className="flex items-center justify-between gap-4 rounded-xl border-2 border-green-500/30 bg-green-500/5 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400">Live URL</p>
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-sm font-medium text-green-600 hover:underline dark:text-green-400"
                  >
                    {liveUrl}
                  </a>
                </div>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  Open ↗
                </a>
              </div>
            )}

            {/* Info grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Source</p>
                {project.sourceUrl ? (
                  <a href={project.sourceUrl} target="_blank" rel="noreferrer"
                    className="mt-2 block truncate text-sm text-primary hover:underline">
                    {(() => { try { return new URL(project.sourceUrl).hostname.replace(/^www\./, "") } catch { return project.sourceUrl } })()}
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Built from scratch</p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Published</p>
                <p className="mt-2 text-sm text-foreground">
                  {new Date(project.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Last updated</p>
                <p className="mt-2 text-sm text-foreground">{timeAgo(project.updatedAt)}</p>
              </div>
            </div>

            {/* Similar projects */}
            {similarProjects.length > 0 && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Similar projects</h2>
                  <Link href="/explore" className="text-xs text-primary hover:underline">View all →</Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {similarProjects.map(sp => {
                    const spThumb = sp.understanding?.screenshots?.[0] ?? null
                    const spDeploy = [...(sp.deploymentHistory ?? [])].reverse().find(d => d.status === "success")
                    const spLive = spDeploy?.productionUrl ? ensureProtocol(spDeploy.productionUrl) : null
                    return (
                      <Link
                        key={sp.id}
                        href={`/public/${sp.id}`}
                        className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md"
                      >
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                          {spThumb ? (
                            <img src={spThumb} alt={sp.name}
                              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-accent/20">
                              <span className="font-mono text-2xl text-muted-foreground/30">{sp.mode === "scratch" ? "✦" : "⬡"}</span>
                            </div>
                          )}
                          {spLive && (
                            <span className="absolute right-2 top-2 rounded-full bg-green-500/90 px-2 py-0.5 font-mono text-[10px] text-white">Live</span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{sp.name}</p>
                          {sp.understanding?.purpose && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{sp.understanding.purpose}</p>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ── Right sidebar ─────────────────────────────────── */}
          <aside className="flex w-full flex-col gap-5 lg:sticky lg:top-24 lg:w-72 lg:shrink-0">

            {/* Author card */}
            {authorDoc && (
              <div className="rounded-xl border border-border bg-card p-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Creator</p>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-bold text-primary overflow-hidden">
                    {authorDoc.imageUrl ? (
                      <img src={authorDoc.imageUrl} alt={authorDoc.name} className="h-full w-full object-cover" />
                    ) : authorInitials(authorDoc.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{authorDoc.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{followCount} follower{followCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Like / follow / fork — client component for interactivity */}
            <PublicProjectActions
              projectId={id}
              authorId={project.userId}
              initialLiked={isLiked}
              initialLikeCount={likeCount}
              initialFollowing={isFollowing}
              alreadyForked={alreadyForked}
              isOwner={isOwner}
              isLoggedIn={Boolean(currentUser)}
              forkCost={forkPricing.forkCost}
              savingsPct={forkPricing.savingsPct}
              forkTier={forkTier}
            />

            {/* Stats card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">Stats</p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Likes</span>
                  <span className="font-mono font-medium text-foreground">{likeCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="font-mono font-medium text-foreground capitalize">{project.mode}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`font-mono text-xs font-medium ${liveUrl ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                    {liveUrl ? "Live" : "Built"}
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="font-semibold text-foreground">Build your own</p>
              <p className="mt-1 text-xs text-muted-foreground">Turn any idea into a working app in minutes</p>
              <div className="mt-4 flex flex-col gap-2">
                <Link href="/login"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                  Get started free
                </Link>
                <Link href="/explore"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent">
                  Browse more projects
                </Link>
              </div>
            </div>

          </aside>
        </div>
      </div>
    </main>
  )
}
