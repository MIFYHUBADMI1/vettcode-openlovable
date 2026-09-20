/**
 * Shared relative-time formatting used across dashboard, projects, workspace,
 * and activity surfaces. One implementation — previously five per-component
 * copies drifted (some rounded, some floored, different thresholds).
 *
 * Intentionally NON-reactive: values are computed at render time and refresh
 * whenever the owning component re-renders (all call sites poll on intervals,
 * so timestamps stay fresh in practice).
 */
export function relativeTime(value: string | number | Date): string {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (Number.isNaN(then)) return ""

  const min = Math.round((Date.now() - then) / 60_000)
  if (min < 1) return "Just now"
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Compact variant for tight UI (notification lists, badges): "3m ago". */
export function relativeTimeShort(value: string | number | Date): string {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (Number.isNaN(then)) return ""

  const min = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (min < 1) return "Just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
