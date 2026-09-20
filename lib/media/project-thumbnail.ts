/** True when a stored screenshot/thumbnail can be given to an <img> src. */
export function isRenderableProjectImage(src: unknown): src is string {
  if (typeof src !== "string") return false
  const value = src.trim()
  if (value.length < 8) return false

  if (value.startsWith("data:image/")) {
    const comma = value.indexOf(",")
    return comma > 10 && value.length - comma > 8
  }

  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

/** Prefer https on public hosts so mixed-content does not blank the image. */
export function normalizeProjectImageUrl(src: string): string {
  const value = src.trim()
  if (!value.startsWith("http://")) return value
  try {
    const url = new URL(value)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return value
    url.protocol = "https:"
    return url.toString()
  } catch {
    return value
  }
}

export function resolveProjectThumbnail(screenshots: unknown): string | null {
  if (!Array.isArray(screenshots)) return null
  for (const item of screenshots) {
    if (!isRenderableProjectImage(item)) continue
    return normalizeProjectImageUrl(item)
  }
  return null
}
