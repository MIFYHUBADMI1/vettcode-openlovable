"use client"

import { Play, Clock, Maximize2 } from "lucide-react"

interface VideoEmbedProps {
  /** Video title shown on the placeholder */
  title: string
  /** Approximate duration text, e.g. "3:45" */
  duration?: string
  /** YouTube or other embed URL — when provided, renders real iframe */
  src?: string
  /** Aspect ratio width (default 16) */
  aspectW?: number
  /** Aspect ratio height (default 9) */
  aspectH?: number
}

export function VideoEmbed({
  title,
  duration = "3:00",
  src,
  aspectW = 16,
  aspectH = 9,
}: VideoEmbedProps) {
  /* Real embed */
  if (src) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border border-border bg-card"
        style={{ aspectRatio: `${aspectW}/${aspectH}` }}
      >
        <iframe
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    )
  }

  /* Placeholder */
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
      {/* Aspect ratio box */}
      <div style={{ aspectRatio: `${aspectW}/${aspectH}` }} className="relative">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />

        {/* Center play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            aria-label={`Play ${title}`}
            className="flex size-16 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 text-primary transition-all hover:scale-110 hover:border-primary/60 hover:bg-primary/20 sm:size-20"
          >
            <Play className="size-7 fill-current sm:size-8" />
          </button>
        </div>

        {/* Top-left label */}
        <div className="absolute left-4 top-4 rounded-md bg-background/80 px-2.5 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
          🎬 Tutorial
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-background/90 to-transparent px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {duration}
            </span>
            <Maximize2 className="size-3" />
          </div>
        </div>
      </div>

      {/* Caption below */}
      <div className="border-t border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Watch a step-by-step walkthrough of getting started with MirrorSite AI — from signing up to publishing your first application.
        </p>
      </div>
    </div>
  )
}
