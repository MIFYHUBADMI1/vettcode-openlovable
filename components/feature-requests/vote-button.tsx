"use client"

import { useState } from "react"
import { Check, ChevronUp } from "lucide-react"
import { toast } from "sonner"
import { deleteJson, postJson } from "@/lib/client/api"
import { cn } from "@/lib/utils"

export function VoteButton({
  id,
  voteCount,
  hasVoted,
  onChange,
  compact,
}: {
  id: string
  voteCount: number
  hasVoted: boolean
  onChange?: (next: { voteCount: number; hasVoted: boolean }) => void
  compact?: boolean
}) {
  const [pending, setPending] = useState(false)
  const [count, setCount] = useState(voteCount)
  const [voted, setVoted] = useState(hasVoted)

  async function toggle() {
    if (pending) return
    const want = !voted
    const prev = { count, voted }
    setVoted(want)
    setCount((c) => Math.max(0, c + (want ? 1 : -1)))
    setPending(true)
    try {
      const res = want
        ? await postJson<{ voteCount: number; hasVoted: boolean }>(`/api/feature-requests/${id}/vote`)
        : await deleteJson<{ voteCount: number; hasVoted: boolean }>(`/api/feature-requests/${id}/vote`)
      setCount(res.voteCount)
      setVoted(res.hasVoted)
      onChange?.(res)
    } catch (e) {
      setCount(prev.count)
      setVoted(prev.voted)
      toast.error(e instanceof Error ? e.message : "Couldn't update your vote.")
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={voted}
      aria-label={voted ? "Remove vote" : "Vote for this request"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        compact ? "min-w-[3.25rem] flex-col px-2 py-1.5" : "h-9 px-3",
        voted
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-accent",
      )}
    >
      {voted ? <Check className="size-3.5" aria-hidden /> : <ChevronUp className="size-3.5" aria-hidden />}
      <span>{compact ? count : voted ? `Voted · ${count}` : `Vote · ${count}`}</span>
    </button>
  )
}
