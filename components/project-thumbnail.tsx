"use client"

import { useState } from "react"
import { isRenderableProjectImage, normalizeProjectImageUrl } from "@/lib/media/project-thumbnail"
import { cn } from "@/lib/utils"

export function ProjectThumbnail({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null
  alt: string
  className?: string
  fallback?: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)
  const resolved = src && isRenderableProjectImage(src) ? normalizeProjectImageUrl(src) : null

  if (!resolved || failed) {
    return fallback ? <>{fallback}</> : null
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("bg-muted", className)}
    />
  )
}
