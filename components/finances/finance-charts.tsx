/**
 * Atai Finance — dependency-free SVG charts.
 *
 * The platform ships no chart library; these render real series as clean
 * SVG (bars for daily flows, a line for cumulative run rates). Everything is
 * server-rendered, accessible, and honest: zero-height bars stay zero.
 */

interface BarSeries {
  /** Human label (for the legend/tooltip anchor). */
  label: string
  value: number
  className: string
}

export function DailyBarChart({
  points,
  height = 160,
}: {
  points: BarSeries[][]
  height?: number
}) {
  if (points.length === 0) return null
  const max = Math.max(...points.flatMap((p) => p.map((s) => s.value)), 1)
  const total = points.length
  const width = Math.max(total * 7, Math.min(total * 14, 720))
  const barGroupW = width / total
  const padBottom = 18
  const plotH = height - padBottom
  const seriesCount = points[0].length

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Daily finance chart"
        preserveAspectRatio="none"
      >
        <line x1="0" y1={plotH} x2={width} y2={plotH} stroke="currentColor" strokeOpacity="0.15" />
        {points.map((group, i) => {
          const groupW = barGroupW * (seriesCount > 1 ? 0.72 : 1)
          const offset = (barGroupW - groupW) / 2
          return (
            <g key={group[0]?.label ?? i} transform={`translate(${i * barGroupW}, 0)`}>
              {group.map((series, j) => {
                const h = max > 0 ? Math.max((series.value / max) * plotH, series.value > 0 ? 2 : 0) : 0
                const segW = seriesCount > 1 ? groupW / seriesCount : groupW
                return series.value > 0 ? (
                  <rect
                    key={j}
                    x={offset + j * segW}
                    y={plotH - h}
                    width={Math.max(segW - 1, 1.5)}
                    height={h}
                    rx="1.5"
                    className={series.className}
                  />
                ) : null
              })}
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>oldest</span>
        <span className="flex flex-wrap items-center gap-3">
          {points[0]?.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span aria-hidden className={`inline-block size-2 rounded-sm ${s.className}`} />
              {s.label}
            </span>
          ))}
        </span>
        <span>today</span>
      </figcaption>
    </figure>
  )
}

/** Thin horizontal distribution bar for the per-capability spend table. */
export function ShareBar({ fraction, className = "bg-primary" }: { fraction: number; className?: string }) {
  const pct = Math.min(Math.max(fraction * 100, 0), 100)
  return (
    <span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-muted align-middle">
      <span className={`block h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </span>
  )
}
