"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface Props {
  projectId: string
  authorId: string
  initialLiked: boolean
  initialLikeCount: number
  initialFollowing: boolean
  alreadyForked: boolean
  isOwner: boolean
  isLoggedIn: boolean
  forkCost: number
  savingsPct: number
  forkTier: "simple" | "medium" | "complex"
}

const TIER_COLOR: Record<string, string> = {
  simple: "text-green-600 dark:text-green-400 bg-green-500/10",
  medium: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  complex: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
}

export function PublicProjectActions({
  projectId,
  authorId,
  initialLiked,
  initialLikeCount,
  initialFollowing,
  alreadyForked,
  isOwner,
  isLoggedIn,
  forkCost,
  savingsPct,
  forkTier,
}: Props) {
  const router = useRouter()
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [following, setFollowing] = useState(initialFollowing)
  const [likePending, setLikePending] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [forking, setForking] = useState(false)
  const [forkConfirm, setForkConfirm] = useState(false)

  async function handleLike() {
    if (!isLoggedIn) { toast.error("Sign in to like projects"); return }
    if (likePending) return
    setLikePending(true)
    const wasLiked = liked
    setLiked(l => !l)
    setLikeCount(c => wasLiked ? c - 1 : c + 1)
    try {
      const res = await fetch(`/api/projects/${projectId}/like`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setLiked(wasLiked)
        setLikeCount(c => wasLiked ? c + 1 : c - 1)
        toast.error(data.message || "Failed to like")
        return
      }
      setLiked(data.data.liked)
      setLikeCount(data.data.likeCount)
    } finally {
      setLikePending(false)
    }
  }

  async function handleFollow() {
    if (!isLoggedIn) { toast.error("Sign in to follow creators"); return }
    if (followPending) return
    setFollowPending(true)
    const wasFollowing = following
    setFollowing(f => !f)
    try {
      const res = await fetch(`/api/users/${authorId}/follow`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setFollowing(wasFollowing)
        toast.error(data.message || "Failed")
        return
      }
      setFollowing(data.data.following)
      toast.success(data.data.following ? "Following creator" : "Unfollowed")
    } finally {
      setFollowPending(false)
    }
  }

  async function handleFork() {
    if (!isLoggedIn) { toast.error("Sign in to fork projects"); return }
    if (forking) return

    // First click → show confirm prompt
    if (!forkConfirm && !alreadyForked) {
      setForkConfirm(true)
      return
    }

    setForking(true)
    setForkConfirm(false)
    try {
      const res = await fetch(`/api/projects/${projectId}/fork`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.message || "Fork failed")
        return
      }
      const d = data.data
      if (d.alreadyForked) {
        toast.info("You already forked this — opening it…")
      } else {
        toast.success(`Forked! ${d.forkCost.toLocaleString()} credits charged. Saves you ${d.savingsPct}% vs building from scratch.`)
      }
      setTimeout(() => router.push(`/project/${d.project.id}`), 1400)
    } finally {
      setForking(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Actions</p>

      {/* Like */}
      <button
        onClick={handleLike}
        disabled={likePending}
        className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${liked
            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            : "border border-border bg-background text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
          }`}
      >
        <span className="flex items-center gap-2">
          <svg className="size-4" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {liked ? "Liked" : "Like this project"}
        </span>
        <span className="font-mono text-xs">{likeCount}</span>
      </button>

      {/* Follow — only for other users */}
      {!isOwner && (
        <button
          onClick={handleFollow}
          disabled={followPending}
          className={`flex w-full items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${following
              ? "bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
              : "border border-border bg-background text-muted-foreground hover:bg-primary/10 hover:text-primary"
            }`}
        >
          <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {following ? "Following creator" : "Follow creator"}
        </button>
      )}

      {/* Fork — only for other users */}
      {!isOwner && (
        <div className="flex flex-col gap-2">

          {/* Pricing info */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                {forkCost.toLocaleString()} credits
              </span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium w-fit ${TIER_COLOR[forkTier]}`}>
                Saves {savingsPct}% vs building
              </span>
            </div>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-medium capitalize ${TIER_COLOR[forkTier]}`}>
              {forkTier}
            </span>
          </div>

          {/* Fork confirm state */}
          {forkConfirm ? (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                This will charge {forkCost.toLocaleString()} credits from your balance. Continue?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleFork}
                  disabled={forking}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {forking ? (
                    <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
                  ) : "✓ Confirm fork"}
                </button>
                <button
                  onClick={() => setForkConfirm(false)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleFork}
              disabled={forking}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
            >
              {forking ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="18" cy="6" r="3" />
                  <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9M12 15v-3" />
                </svg>
              )}
              {forking ? "Forking…" : alreadyForked ? "Open your fork →" : "Fork into workspace"}
            </button>
          )}
        </div>
      )}

      {/* Owner message */}
      {isOwner && (
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground">This is your project</p>
          <p className="mt-0.5 text-xs font-medium text-foreground">
            You earn {
              forkTier === "complex" ? "15,000" : forkTier === "medium" ? "10,000" : "5,000"
            } credits per fork
          </p>
        </div>
      )}
    </div>
  )
}
