"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { PlanChangeDialog } from "@/components/billing/plan-change-dialog"
import { formatUSD, CREDIT_UNIT_NAME, SUBSCRIPTION_PLANS } from "@/lib/billing/config"
import type { SubscriptionPlan } from "@/lib/billing/config"
import Link from "next/link"
import { toast } from "sonner"

interface PlanCardProps {
  plan: SubscriptionPlan
  activePlanId?: string | null
  currentPeriodEnd?: number | null
  isLoggedIn?: boolean
  className?: string
}

export function PlanCard({
  plan,
  activePlanId,
  currentPeriodEnd,
  isLoggedIn = false,
  className,
}: PlanCardProps) {
  const [selected, setSelected] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [checkoutPending, setCheckoutPending] = useState(false)

  const isActive = activePlanId === plan.id
  const hasOtherActivePlan = Boolean(activePlanId) && !isActive && activePlanId !== "free"
  const isHighlighted = selected || isActive || plan.popular

  const currentPlan = hasOtherActivePlan
    ? (SUBSCRIPTION_PLANS.find((p) => p.id === activePlanId) ?? null)
    : null

  function handleCardClick() {
    if (isActive) return
    setSelected((s) => !s)
  }

  function handleSubscribeClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (hasOtherActivePlan && currentPlan) {
      setDialogOpen(true)
    }
  }

  return (
    <>
      <div
        role={isActive ? "article" : "button"}
        tabIndex={isActive ? undefined : 0}
        aria-pressed={!isActive ? selected : undefined}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (!isActive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            setSelected((s) => !s)
          }
        }}
        className={cn(
          "relative rounded-xl border p-6 transition-all duration-150 outline-none",
          !isActive && "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          !isHighlighted && "border-border bg-card hover:border-primary/40 hover:shadow-sm",
          plan.popular && !selected && !isActive && "border-primary/50 bg-card shadow-lg shadow-primary/5",
          selected && !isActive && "border-primary bg-primary/5 shadow-lg shadow-primary/10 ring-2 ring-primary/20",
          isActive && "border-primary bg-primary/5 ring-2 ring-primary/30 cursor-default",
          className,
        )}
      >
        {plan.popular && (
          <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground select-none">
            Most Popular
          </div>
        )}

        {selected && !isActive && (
          <div className="absolute -top-3 right-6 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground select-none">
            Selected
          </div>
        )}

        {isActive && (
          <div className="absolute -top-3 right-6 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white flex items-center gap-1 select-none">
            <Check className="size-3" /> Current Plan
          </div>
        )}

        <div>
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <span className="text-xs font-bold text-primary">{plan.name[0]}</span>
          </div>
          <h3 className="mt-3 font-semibold text-lg">{plan.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{plan.tagline}</p>
        </div>

        <div className="mt-5 pb-5 border-b border-border">
          {plan.priceUSD === 0 ? (
            <span className="text-3xl font-bold">Free</span>
          ) : (
            <>
              <span className="text-3xl font-bold">{formatUSD(plan.priceUSD)}</span>
              <span className="ml-1 text-sm text-muted-foreground">/month</span>
            </>
          )}
          <p className="mt-1 text-xs text-muted-foreground font-mono">
            {plan.mirrorCredits > 0
              ? `${plan.mirrorCredits.toLocaleString()} ${CREDIT_UNIT_NAME}`
              : "500 credits on verification"}
          </p>
        </div>

        <ul className="mt-5 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              {feature.startsWith("Everything in") ? (
                <span className="mt-0.5 font-medium text-primary text-xs shrink-0">↳</span>
              ) : (
                <Check className="size-3.5 text-primary mt-0.5 shrink-0" />
              )}
              <span className={cn(
                "text-muted-foreground",
                feature.startsWith("Everything in") && "font-medium text-foreground text-xs",
              )}>
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {plan.notIncluded && plan.notIncluded.length > 0 && (
          <ul className="mt-4 space-y-2">
            {plan.notIncluded.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <X className="size-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
                <span className="text-muted-foreground/50 line-through decoration-muted-foreground/30">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          {isLoggedIn ? (
            plan.id === "free" ? (
              isActive ? (
                <button disabled className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium opacity-50 cursor-not-allowed">
                  Current Plan
                </button>
              ) : null
            ) : hasOtherActivePlan && currentPlan ? (
              <button
                onClick={handleSubscribeClick}
                className={cn(
                  "mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  (plan.popular || selected)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border hover:bg-accent bg-background text-foreground",
                )}
              >
                Switch to {plan.name}
              </button>
            ) : (
              <CheckoutButton
                type="subscription"
                productId={plan.id}
                className={cn(
                  "mt-6 w-full",
                  (plan.popular || selected)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border hover:bg-accent bg-background text-foreground",
                )}
                disabled={isActive}
              >
                {isActive ? "Current Plan" : selected ? "Subscribe to Selected" : "Subscribe Now"}
              </CheckoutButton>
            )
          ) : (
            <Link
              href="/register"
              className={cn(
                "mt-6 block text-center py-2.5 rounded-lg text-sm font-medium transition-colors",
                plan.id === "free"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : (plan.popular || selected)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border hover:bg-accent",
              )}
            >
              {plan.id === "free" ? "Get Started Free" : "Get Started"}
            </Link>
          )}
        </div>
      </div>

      {hasOtherActivePlan && currentPlan && (
        <PlanChangeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          currentPlan={currentPlan}
          targetPlan={plan}
          currentPeriodEnd={currentPeriodEnd ?? null}
          loading={checkoutPending}
          onConfirm={() => {
            setCheckoutPending(true)
            setDialogOpen(false)
            fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "subscription", productId: plan.id }),
            })
              .then((r) => r.json())
              .then((json) => {
                if (json.ok && json.data?.checkoutUrl) {
                  window.location.href = json.data.checkoutUrl
                } else {
                  toast.error(json.error?.message ?? "Failed to start checkout. Please try again.")
                  setCheckoutPending(false)
                }
              })
              .catch((err) => {
                console.error("Checkout error:", err)
                toast.error("Network error. Please try again.")
                setCheckoutPending(false)
              })
          }}
        />
      )}
    </>
  )
}
