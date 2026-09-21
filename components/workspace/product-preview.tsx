"use client"

import { useState, type MouseEvent, type TouchEvent } from "react"
import { ensureProtocol, cn } from "@/lib/utils"

type Viewport = "desktop" | "tablet" | "mobile"

const VIEWPORTS: Record<Viewport, { width: string; defaultHeight: number; label: string }> = {
  desktop: { width: "100%", defaultHeight: 600, label: "Desktop" },
  tablet: { width: "768px", defaultHeight: 600, label: "Tablet" },
  mobile: { width: "375px", defaultHeight: 667, label: "Mobile" },
}

const MIN_HEIGHT = 200
const MAX_HEIGHT = 1200

export function ProductPreview({ url, name }: { url: string; name: string }) {
  const safeUrl = ensureProtocol(url)
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [height, setHeight] = useState(VIEWPORTS.desktop.defaultHeight)
  const [dragging, setDragging] = useState(false)
  const vp = VIEWPORTS[viewport]

  function handleViewportChange(v: Viewport) {
    setViewport(v)
    setHeight(VIEWPORTS[v].defaultHeight)
  }

  function handleDragStart(e: MouseEvent | TouchEvent) {
    e.preventDefault()
    setDragging(true)
    const startY = "touches" in e ? e.touches[0].clientY : e.clientY
    const startHeight = height

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const currentY = "touches" in ev ? ev.touches[0].clientY : ev.clientY
      setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + (currentY - startY))))
    }
    const onEnd = () => {
      setDragging(false)
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onEnd)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend", onEnd)
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onEnd)
    document.addEventListener("touchmove", onMove, { passive: false })
    document.addEventListener("touchend", onEnd)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2.5">
        <p className="truncate font-mono text-[11px] text-muted-foreground">{safeUrl}</p>
        <div className="flex items-center gap-1">
          {(Object.keys(VIEWPORTS) as Viewport[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleViewportChange(v)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] font-medium",
                viewport === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEWPORTS[v].label}
            </button>
          ))}
          <a href={safeUrl} target="_blank" rel="noreferrer" className="ml-2 text-[11px] font-medium text-primary hover:underline">
            Open in new tab
          </a>
        </div>
      </div>
      <div className="flex justify-center bg-muted/30">
        <div className="overflow-hidden bg-background transition-[width] duration-300" style={{ width: vp.width, maxWidth: "100%" }}>
          <iframe
            src={safeUrl}
            title={`${name} preview`}
            className="w-full border-0 bg-background"
            style={{ height: `${height}px` }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className={cn("flex cursor-row-resize select-none items-center justify-center border-t border-border bg-muted/60 py-2", dragging && "bg-primary/10")}
      >
        <span className="font-mono text-[10px] text-muted-foreground">{height}px</span>
      </div>
    </div>
  )
}
