"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react"

interface SectionFeedbackProps {
  /** Unique ID of the section this feedback is for */
  sectionId: string
}

export function SectionFeedback({ sectionId }: SectionFeedbackProps) {
  const [vote, setVote] = useState<"up" | "down" | null>(null)

  if (vote) {
    return (
      <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-primary shrink-0" />
        <span>
          {vote === "up"
            ? "Glad this helped! Thanks for the feedback."
            : "Sorry to hear that. We'll work on improving this section."}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-8 flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
      <span>Was this section helpful?</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setVote("up")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
          aria-label="Yes, this was helpful"
        >
          <ThumbsUp className="size-3.5" />
          Yes
        </button>
        <button
          onClick={() => setVote("down")}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-border hover:bg-accent/50 hover:text-foreground"
          aria-label="No, this was not helpful"
        >
          <ThumbsDown className="size-3.5" />
          No
        </button>
      </div>
    </div>
  )
}
