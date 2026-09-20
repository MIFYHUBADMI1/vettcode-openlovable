import Link from "next/link"
import { CATEGORY_META, TYPE_LABEL, type ResourceSummary } from "@/lib/resources"
import { cn } from "@/lib/utils"

export function ResourceCard({
  resource,
  className,
}: {
  resource: ResourceSummary
  className?: string
}) {
  return (
    <article>
      <Link
        href={resource.href}
        className={cn(
          "group flex h-full flex-col rounded-2xl border border-border/80 bg-card p-5 transition-colors hover:border-indigo-500/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {CATEGORY_META[resource.category].label} · {TYPE_LABEL[resource.type]}
        </p>
        <h3 className="mt-3 text-base font-semibold tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
          {resource.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{resource.description}</p>
        <p className="mt-4 text-xs text-muted-foreground">{resource.readingMinutes} min read</p>
      </Link>
    </article>
  )
}
