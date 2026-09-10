"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Calendar, Check, Clock, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatUSD, CREDIT_UNIT_NAME } from "@/lib/billing/config"
import type { SubscriptionPlan } from "@/lib/billing/config"

interface PlanChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The plan the user is currently on */
  currentPlan: SubscriptionPlan
  /** The plan the user wants to switch to */
  targetPlan: SubscriptionPlan
  /**
   * Unix timestamp (ms) when the current billing period ends.
   * The user keeps their current plan's credits until this date.
   */
  currentPeriodEnd: number | null
  /** Called when the user confirms they want to proceed to checkout */
  onConfirm: () => void
  /** True while the checkout redirect is in progress */
  loading?: boolean
}

function formatTimeRemaining(endMs: number): string {
  const now = Date.now()
  const diffMs = endMs - now
  if (diffMs <= 0) return "expired"

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} and ${hours} hour${hours !== 1 ? "s" : ""}`
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""}`
  const mins = Math.floor(diffMs / (1000 * 60))
  return `${mins} minute${mins !== 1 ? "s" : ""}`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

const isUpgrade = (current: SubscriptionPlan, target: SubscriptionPlan) =>
  target.priceUSD > current.priceUSD

export function PlanChangeDialog({
  open,
  onOpenChange,
  currentPlan,
  targetPlan,
  currentPeriodEnd,
  onConfirm,
  loading = false,
}: PlanChangeDialogProps) {
  const upgrade = isUpgrade(currentPlan, targetPlan)
  const timeRemaining = currentPeriodEnd ? formatTimeRemaining(currentPeriodEnd) : null
  const endDate = currentPeriodEnd ? formatDate(currentPeriodEnd) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {upgrade ? (
              <Sparkles className="size-4 text-primary shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            )}
            {upgrade ? "Upgrade your plan" : "Change your plan"}
          </DialogTitle>
          <DialogDescription>
            You currently have an active subscription. Here's what happens when you switch.
          </DialogDescription>
        </DialogHeader>

        {/* Plan comparison */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          {/* Current plan */}
          <div className="flex-1 rounded-md border border-border bg-card p-3 text-center">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Current</p>
            <p className="font-semibold text-sm">{currentPlan.name}</p>
            <p className="font-mono text-xs text-primary mt-0.5">
              {currentPlan.priceUSD === 0 ? "Free" : `${formatUSD(currentPlan.priceUSD)}/mo`}
            </p>
          </div>

          <ArrowRight className="size-4 text-muted-foreground shrink-0" />

          {/* Target plan */}
          <div className={cn(
            "flex-1 rounded-md border p-3 text-center",
            upgrade ? "border-primary/50 bg-primary/5" : "border-amber-500/30 bg-amber-500/5",
          )}>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">New</p>
            <p className="font-semibold text-sm">{targetPlan.name}</p>
            <p className={cn("font-mono text-xs mt-0.5", upgrade ? "text-primary" : "text-amber-600")}>
              {formatUSD(targetPlan.priceUSD)}/mo
            </p>
          </div>
        </div>

        {/* Current period info */}
        {currentPeriodEnd && (
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3">
              <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Time remaining on current plan</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{timeRemaining}</span> remaining
                  {endDate && (
                    <> — period ends <span className="font-medium text-foreground">{endDate}</span></>
                  )}
                </p>
              </div>
            </div>

            {/* Credits retention notice */}
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  Your credits are safe
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Your current{" "}
                  <span className="font-medium text-foreground">
                    {currentPlan.mirrorCredits.toLocaleString()} {CREDIT_UNIT_NAME}
                  </span>{" "}
                  and any unused credits remain available until{" "}
                  <span className="font-medium text-foreground">{endDate}</span>.
                  Switching plans now starts a new billing cycle — your new plan's credits are
                  added after your current period expires.
                </p>
              </div>
            </div>

            {/* Calendar */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3">
              <Calendar className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">New billing starts</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Your <span className="font-medium text-foreground">{targetPlan.name}</span> plan
                  and its{" "}
                  <span className="font-medium text-foreground">
                    {targetPlan.mirrorCredits.toLocaleString()} {CREDIT_UNIT_NAME}/month
                  </span>{" "}
                  will begin after your current period ends on{" "}
                  <span className="font-medium text-foreground">{endDate}</span>.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {/* Cancel */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            Keep current plan
          </button>

          {/* Confirm */}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
              upgrade
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-amber-500 text-white hover:bg-amber-600",
            )}
          >
            {loading ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Redirecting...
              </>
            ) : (
              <>
                {upgrade ? <Sparkles className="size-3.5" /> : <ArrowRight className="size-3.5" />}
                Switch to {targetPlan.name}
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
