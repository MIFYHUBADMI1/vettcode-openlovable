"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CheckoutButton } from "@/components/billing/checkout-button"
import { formatUSD, CREDIT_UNIT_NAME } from "@/lib/billing/config"
import type { SubscriptionPlan } from "@/lib/billing/config"
import Link from "next/link"

interface PlanCardProps {
  plan: SubscriptionPlan
  /** If provided, the card with this planId is shown as the active subscription */
  activePlanId?: string | null
  /** Whether the user is logged in — controls CTA button vs register link */
  isLoggedIn?: boolean
  /** Extra class on the outer wrapper */
  className?: string
}

/**
 * Subscription plan card with click-to-select highlight.
 * Used on /pricing (not logged in / logged in) and /settings/billing.
 */
export function PlanCard({ plan, activePlanId, isLoggedIn = false, className }: PlanCardProps) {
  const [selected, setSelected] = useState(false)

  const isActive = activePlanId === plan.id
  const isHighlighted = selected || isActive || plan.popular

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => setSelected((s) => !s)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected((s) => !s) } }}
      className={cn(
        "relative flex flex-col rounded-xl border p-6 transition-all duration-150 cursor-pointer outline-none",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        // Base state
        !isHighlighted && "border-border bg-card hover:border-primary/40 hover:shadow-sm",
        // Popular (always highlighted regardless of selection)
        plan.popular && !selected && !isActive && "border-primary/50 bg-card shadow-lg shadow-primary/5",
        // Explicitly selected by click
        selected && !isActive && "border-primary bg-primary/5 shadow-lg shadow-primary/10 ring-2 ring-primary/20",
        // Active subscription
        isActive && "border-primary bg-primary/5 ring-2 ring-primary/30",
        className,
      )}
    >
      {/* Most Popular badge */}
      {plan.popular && (
        <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground select-none">
          Most Popular
        </div>
      )}

      {/* Selected indicator */}
      {selected && !isActive && (
        <div className="absolute -top-3 right-6 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground select-none">
          Selected
        </div>
      )}

      {/* Active indicator */}
      {isActive && (
        <div className="absolute -top-3 right-6 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white flex items-center gap-1 select-none">
          <Check className="size-3" /> Current Plan
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <span className="text-xs font-bold text-primary">{plan.name[0]}</span>
        </div>
        <h3 className="mt-3 font-semibold text-lg">{plan.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{plan.tagline}</p>
      </div>

      {/* Price */}
      <div className="mt-5 pb-5 border-b border-border">
        <span className="text-3xl font-bold">{formatUSD(plan.priceUSD)}</span>
        <span className="ml-1 text-sm text-muted-foreground">/month</span>
        <p className="mt-1 text-xs text-muted-foreground font-mono">
          {plan.mirrorCredits.toLocaleString()} {CREDIT_UNIT_NAME}
        </p>
      </div>

      {/* Included features */}
      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="size-3.5 text-primary mt-0.5 shrink-0" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Not included */}
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

      {/* CTA — stop propagation so clicking the button doesn't toggle selection */}
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {isLoggedIn ? (
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
        ) : (
          <Link
            href="/register"
            className={cn(
              "mt-6 block text-center py-2.5 rounded-lg text-sm font-medium transition-colors",
              (plan.popular || selected)
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-border hover:bg-accent",
            )}
          >
            Get Started
          </Link>
        )}
      </div>
    </div>
  )
}
