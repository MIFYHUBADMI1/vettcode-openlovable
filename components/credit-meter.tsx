"use client"

import Link from "next/link"
import { useSession } from "@/lib/client/api"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function CreditMeter({ className }: { className?: string }) {
  const { session, isLoading } = useSession()

  if (isLoading || !session) {
    return <Skeleton className={cn("h-9 w-32", className)} />
  }

  const { balance, available } = session.credits
  const needsVerification = !session.user.emailVerified && balance === 0
  const isLow = !needsVerification && available < 1000

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border border-border bg-card px-3 py-1.5",
          needsVerification && "border-amber-500/40",
        )}
        title={needsVerification ? "Verify your email to receive 500 welcome credits" : `${available.toLocaleString()} available · ${balance.toLocaleString()} total`}
      >
        <div className="flex flex-col">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Credits</span>
          {needsVerification ? (
            <span className="font-mono text-xs text-amber-500">Verify email</span>
          ) : (
            <span className="font-mono text-sm font-medium text-foreground tabular-nums">
              {available.toLocaleString()}
              <span className="text-muted-foreground"> / {balance.toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>
      {isLow && (
        <Link
          href="/billing/top-up"
          className="credit-topup-glow relative inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[11px] font-medium text-primary transition-all hover:bg-primary/20 hover:border-primary/60"
        >
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Running low? Top up
        </Link>
      )}
    </div>
  )
}
