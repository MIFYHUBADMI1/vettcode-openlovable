"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import useSWR from "swr"
import { Coins, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { jsonFetcher, useSession } from "@/lib/client/api"
import { markPaymentHandoff, type CreditShortfall } from "@/lib/client/credit-gate"
import type { UpgradeAdvice, UpgradeOption } from "@/lib/billing/upgrade-options"
import { cn } from "@/lib/utils"

function credits(value: number): string {
  return value.toLocaleString()
}

function price(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

function optionLine(option: UpgradeOption): string {
  return option.kind === "pack"
    ? `${credits(option.credits)} credits, never expire`
    : `${credits(option.credits)} credits every month`
}

function OptionCard({
  option,
  returnPath,
  coversShortfall,
}: {
  option: UpgradeOption
  returnPath: string
  coversShortfall: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
        option.recommended && "border-primary/40 bg-primary/[0.04]",
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{option.title}</p>
          {option.recommended ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              <Sparkles className="size-3" aria-hidden />
              Best value for this
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{optionLine(option)}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          {price(option.priceUSD)} {option.cadence === "monthly" ? "/ month" : "once"} · ≈{credits(option.creditsPerDollar)} credits per $1
        </p>
      </div>

      <CheckoutButton
        type={option.kind === "pack" ? "permanent" : "subscription"}
        productId={option.productId}
        returnPath={returnPath}
        onBeforeCheckout={markPaymentHandoff}
        className="w-full shrink-0 sm:w-auto"
      >
        {coversShortfall ? `Pay ${price(option.priceUSD)} and continue` : `Add ${credits(option.credits)} credits`}
      </CheckoutButton>
    </div>
  )
}

/**
 * The overlay a founder sees the moment an action costs more than their
 * balance. It states the gap in numbers, offers the two honest ways to close
 * it, and hands off to the payment page with a return path back to wherever
 * they were — the provider resumes the interrupted request when they land.
 */
export function CreditGateDialog({
  open,
  shortfall,
  onOpenChange,
  checking = false,
  resumeError = null,
  onResume,
}: {
  open: boolean
  shortfall: CreditShortfall | null
  onOpenChange: (open: boolean) => void
  checking?: boolean
  resumeError?: string | null
  onResume?: () => void
}) {
  const { session } = useSession()
  const returnPath = usePathname() ?? "/settings/billing"

  const required = shortfall?.required ?? null
  const query = required === null ? "" : `?required=${required}`
  const { data, error, isLoading } = useSWR<UpgradeAdvice>(
    open ? `/api/billing/upgrade-options${query}` : null,
    jsonFetcher,
    { revalidateOnFocus: true, dedupingInterval: 2_000 },
  )

  const available = session?.credits.available ?? data?.available ?? shortfall?.available ?? null
  const costKnown = required !== null
  const gap = required !== null && available !== null ? Math.max(0, required - available) : null
  const funded = gap === 0
  const options = data?.options ?? []
  const resumePromise = shortfall?.request
    ? "Once the credits land you come straight back here and it carries on by itself."
    : "Once the credits land you come straight back here and can run it again."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <div className="flex items-center gap-2 text-primary">
            <Coins className="size-4" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-widest">Credits needed</span>
          </div>
          <DialogTitle className="mt-1.5 text-lg">
            {shortfall?.action && shortfall.action !== "this"
              ? `Add credits to keep ${shortfall.action} going`
              : "Add credits to continue"}
          </DialogTitle>
          <DialogDescription>
            {funded ? "You now have enough credits to continue." : costKnown && available !== null ? (
              <>
                This costs <strong className="font-semibold text-foreground tabular-nums">{credits(required ?? 0)}</strong>{" "}
                credits. You have{" "}
                <strong className="font-semibold text-foreground tabular-nums">{credits(available)}</strong>{" "}
                available — that leaves you{" "}
                <strong className="font-semibold text-foreground tabular-nums">{credits(gap ?? 0)}</strong> short.
              </>
            ) : (
              shortfall?.message ??
              "Your balance does not cover this action. Add credits to continue."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-2.5">
          {checking ? (
            <p role="status" className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Confirming your credits. This resumes automatically when they arrive — you do not need to pay again.
            </p>
          ) : funded && shortfall?.request && onResume ? (
            <Button onClick={onResume}>Continue {shortfall.action === "this" ? "your action" : shortfall.action}</Button>
          ) : funded ? null : isLoading ? (
            <>
              <Skeleton className="h-[76px] rounded-xl" />
              <Skeleton className="h-[76px] rounded-xl" />
            </>
          ) : error ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              We couldn't load your top-up options just now. You can still{" "}
              <Link href="/settings/billing" className="underline underline-offset-3 hover:text-foreground">
                add credits from billing
              </Link>
              .
            </div>
          ) : (
            options.map((option) => (
              <OptionCard key={`${option.kind}:${option.productId}`} option={option} returnPath={returnPath} coversShortfall={gap !== null && option.credits >= gap} />
            ))
          )}

          {data && !data.anyOptionCovers ? (
            <p className="text-xs text-muted-foreground">
              None of these covers the whole gap in one purchase — top up as far as you like, then run it again.
            </p>
          ) : null}
        </div>

        {resumeError ? <p role="alert" className="mt-3 text-sm text-destructive">{resumeError}</p> : null}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{resumePromise}</p>

        <DialogFooter className="mt-4 sm:justify-between">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-lg px-1 py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Compare all plans
          </Link>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
