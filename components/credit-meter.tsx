"use client"

import Link from "next/link"
import { Coins } from "lucide-react"
import { useSession } from "@/lib/client/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function CreditMeter({
  className,
  showTopUp = true,
  compact = false,
}: {
  className?: string
  showTopUp?: boolean
  /** Always use the single-line chip — for narrow rails and top bars. */
  compact?: boolean
}) {
  const { session, isLoading } = useSession()

  if (isLoading) {
    return <Skeleton className={cn("h-9 w-24 shrink-0 rounded-md sm:w-32", className)} />
  }

  // Public pages render the header without a session — don't leave a fake loader behind.
  if (!session) return null

  const { balance, available } = session.credits
  const needsVerification = !session.user.emailVerified && balance === 0
  const isLow = !needsVerification && available < 1000

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div
        className={cn(
          "flex h-9 shrink-0 items-center rounded-md border border-border bg-card px-2 sm:px-3",
          needsVerification && "border-amber-500/40",
        )}
        title={needsVerification ? "Verify your email to receive 500 welcome credits" : `${available.toLocaleString()} available · ${balance.toLocaleString()} total`}
      >
        <span className={compact ? "flex items-center gap-1.5" : "flex items-center gap-1.5 sm:hidden"}>
          <Coins className="size-3.5 text-muted-foreground" />
          {needsVerification ? (
            <span className="font-mono text-[11px] font-medium text-amber-500">Verify</span>
          ) : (
            <span className="font-mono text-xs font-medium text-foreground tabular-nums">
              {available.toLocaleString()}
            </span>
          )}
        </span>

        <span className={compact ? "hidden" : "hidden items-center gap-2 sm:flex"}>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Credits</span>
          {needsVerification ? (
            <span className="font-mono text-xs text-amber-500">Verify email</span>
          ) : (
            <span className="font-mono text-sm font-medium text-foreground tabular-nums">
              {available.toLocaleString()}
              <span className="text-muted-foreground"> / {balance.toLocaleString()}</span>
            </span>
          )}
        </span>
      </div>
      {isLow && showTopUp ? (
        <Link
          href="/settings/billing"
          className="credit-topup-glow hidden h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 font-mono text-[11px] font-medium text-primary transition-all hover:border-primary/60 hover:bg-primary/20 xl:inline-flex"
        >
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Running low? Top up
        </Link>
      ) : null}
    </div>
  )
}
