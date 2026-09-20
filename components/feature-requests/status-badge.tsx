import { cn } from "@/lib/utils"
import { STATUS_LABEL, type FeatureRequestStatus } from "@/lib/feature-requests/config"

const TONE: Record<FeatureRequestStatus, string> = {
  submitted: "border-border text-muted-foreground",
  under_review: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  planned: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  in_progress: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  shipped: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  declined: "border-border bg-muted text-muted-foreground",
  duplicate: "border-border text-muted-foreground",
}

export function StatusBadge({ status, className }: { status: FeatureRequestStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium",
        TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
