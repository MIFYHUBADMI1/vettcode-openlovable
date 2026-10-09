"use client"

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react"
import { ensureProtocol, cn } from "@/lib/utils"
import { isRenderableProjectImage, normalizeProjectImageUrl } from "@/lib/media/project-thumbnail"

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

  function handleDragStart(e: ReactMouseEvent | ReactTouchEvent) {
    e.preventDefault()
    setDragging(true)
    const startY = "touches" in e ? e.touches[0].clientY : e.clientY
    const startHeight = height

    const onMove = (ev: globalThis.MouseEvent | globalThis.TouchEvent) => {
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

function pickReferenceScreenshot(screenshots: unknown): string | null {
  if (!Array.isArray(screenshots)) return null
  const urls = screenshots
    .filter(isRenderableProjectImage)
    .map((src) => normalizeProjectImageUrl(src))
  const fromCrawl = urls.filter((url) => !/app-preview/i.test(url))
  return fromCrawl[0] ?? null
}

/** Live iframe of the original site; remounts after idle so it doesn't stay blank. */
export function ReferenceSitePreview({
  url,
  name,
  screenshots,
}: {
  url: string
  name: string
  screenshots?: unknown
}) {
  const safeUrl = ensureProtocol(url)
  const snapshot = pickReferenceScreenshot(screenshots)
  const [frameKey, setFrameKey] = useState(0)
  const [useSnapshot, setUseSnapshot] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  function reloadLive() {
    setUseSnapshot(false)
    setFrameKey((key) => key + 1)
  }

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now()
        return
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0
      hiddenAt.current = null
      if (away >= 30_000) setFrameKey((key) => key + 1)
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setFrameKey((key) => key + 1)
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  const showSnapshot = useSnapshot && Boolean(snapshot) && !imageFailed

  return (
    <div className="overflow-hidden bg-muted/30">
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 px-4 py-2">
        <button type="button" onClick={reloadLive} className="text-[11px] font-medium text-primary hover:underline">
          Reload live preview
        </button>
        {snapshot ? (
          <button
            type="button"
            onClick={() => setUseSnapshot((v) => !v)}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            {showSnapshot ? "Show live site" : "Show snapshot"}
          </button>
        ) : null}
      </div>
      {showSnapshot ? (
        <a href={safeUrl} target="_blank" rel="noreferrer" className="block bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={snapshot!}
            alt={`Reference snapshot of ${name}`}
            className="max-h-[520px] w-full object-cover object-top"
            onError={() => setImageFailed(true)}
          />
        </a>
      ) : (
        <iframe
          key={frameKey}
          src={safeUrl}
          title={`${name} preview`}
          className="w-full border-0 bg-background"
          style={{ height: "600px" }}
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      )}
    </div>
  )
}
