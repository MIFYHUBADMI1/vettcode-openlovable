import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import Markdown from "react-markdown"
import { cn } from "@/lib/utils"

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info"

const BADGE_TONES: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
}

export function PlanBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-border bg-background/70 px-2 py-0.5 text-xs text-foreground/90">
      {label}
    </span>
  )
}

export function ChipRow({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label, index) => (
        <Chip key={`${label}-${index}`} label={label} />
      ))}
    </div>
  )
}

export function SectionCard({
  id,
  icon: Icon,
  title,
  description,
  count,
  actions,
  children,
  tone = "card",
}: {
  id: string
  icon: LucideIcon
  title: string
  description?: string
  count?: number
  actions?: ReactNode
  children: ReactNode
  /** `accent` marks the sections a reader should land on first. */
  tone?: "card" | "accent"
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div
        className={cn(
          "rounded-2xl border p-5 shadow-sm sm:p-6",
          tone === "accent" ? "border-primary/30 bg-primary/5" : "border-border bg-card",
        )}
      >
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-[18px] text-primary" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{title}</h2>
              {description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {typeof count === "number" ? <PlanBadge className="font-mono tabular-nums">{count}</PlanBadge> : null}
            {actions}
          </div>
        </header>
        {children}
      </div>
    </section>
  )
}

export function Field({
  label,
  children,
  className,
  multiline,
}: {
  label: string
  children: ReactNode
  className?: string
  multiline?: boolean
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-background/60 px-4 py-3", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className={cn("mt-1.5 text-sm leading-6 text-foreground/90", multiline && "whitespace-pre-wrap")}>
        {children}
      </div>
    </div>
  )
}

export function BulletList({ items, tone = "primary" }: { items: string[]; tone?: Tone }) {
  const dot = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-amber-500",
    danger: "bg-destructive",
    info: "bg-blue-500",
    neutral: "bg-muted-foreground/40",
  }[tone]
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
          <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", dot)} />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-base font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Meter({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" | "danger" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const fill = { primary: "bg-primary/70", success: "bg-success/70", warning: "bg-amber-500/70", danger: "bg-destructive/70" }[tone]
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function MarkdownBlock({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words text-muted-foreground [&_pre]:overflow-x-auto [&_code]:break-all [&_a]:break-all",
        className,
      )}
    >
      <Markdown>{text}</Markdown>
    </div>
  )
}

export function SubLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  )
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  )
}
