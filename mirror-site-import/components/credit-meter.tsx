"use client"

import { useSession } from "@/lib/client/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function CreditMeter({ className }: { className?: string }) {
  const { session, isLoading } = useSession()

  if (isLoading || !session) {
    return <Skeleton className={cn("h-9 w-32", className)} />
  }

  const { balance, reserved, available } = session.credits
  const usedRatio = balance > 0 ? Math.min(1, reserved / balance) : 0

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5",
        className,
      )}
      title={`${available} available · ${reserved} reserved · ${balance} total`}
    >
      <div className="flex flex-col">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Credits</span>
        <span className="font-mono text-sm font-medium text-foreground tabular-nums">
          {available.toLocaleString()}
          <span className="text-muted-foreground"> / {balance.toLocaleString()}</span>
        </span>
      </div>
      <div className="h-8 w-px bg-border" aria-hidden />
      <div className="flex h-8 w-16 items-end gap-0.5" aria-hidden>
        <div className="relative h-full w-full overflow-hidden rounded-sm bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-accent/40 transition-all"
            style={{ width: `${usedRatio * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
