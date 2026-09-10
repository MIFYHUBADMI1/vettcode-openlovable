"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Sparkles, TrendingDown, Gift, CheckCircle, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { SUBSCRIPTION_PLANS } from "@/lib/billing/config"

interface CancelSubscriptionButtonProps {
  planName: string
  periodEnd: number
  monthlyCredits: number
  priceUSD: number
  currentPlanId: string
  className?: string
}

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "It's too expensive for my needs", hasDiscount: true },
  { value: "not_using_enough", label: "I'm not using it enough", requiresFeedback: true },
  { value: "missing_features", label: "Missing features I need", requiresFeedback: true },
  { value: "switching_competitor", label: "Switching to a competitor", requiresFeedback: true },
  { value: "technical_issues", label: "Experiencing technical issues", requiresFeedback: true },
  { value: "temporary_pause", label: "I need a temporary break", requiresFeedback: true },
  { value: "project_completed", label: "My project is completed", requiresFeedback: true },
  { value: "other", label: "Other reason", requiresFeedback: true },
]

const DISCOUNT_CODE = "9W1JK59M0JSL"

export function CancelSubscriptionButton({
  planName,
  periodEnd,
  monthlyCredits,
  priceUSD,
  currentPlanId,
  className,
}: CancelSubscriptionButtonProps) {
  const router = useRouter()
  const [step, setStep] = useState<"initial" | "retention" | "reason" | "discount" | "processing">("initial")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>("")
  const [additionalFeedback, setAdditionalFeedback] = useState("")
  const [copied, setCopied] = useState(false)

  const periodEndDate = new Date(periodEnd).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  // Get cheaper plans for downgrade option
  const currentPlan = SUBSCRIPTION_PLANS.find((p) => p.id === currentPlanId)
  const cheaperPlans = SUBSCRIPTION_PLANS.filter(
    (p) => !p.custom && p.id !== "free" && p.priceUSD > 0 && p.priceUSD < (currentPlan?.priceUSD || 0)
  ).sort((a, b) => b.priceUSD - a.priceUSD)

  const handleCancel = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Save feedback
      await fetch("/api/billing/subscription/cancel-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason,
          feedback: additionalFeedback,
          planName,
        }),
      })

      // Cancel subscription
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription")
      }

      router.refresh()
      setStep("initial")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setStep("initial")
    setError(null)
    setSelectedReason("")
    setAdditionalFeedback("")
    setCopied(false)
  }

  const copyDiscountCode = () => {
    navigator.clipboard.writeText(DISCOUNT_CODE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedReasonData = CANCELLATION_REASONS.find((r) => r.value === selectedReason)
  const requiresFeedback = selectedReasonData?.requiresFeedback || false
  const canProceed = selectedReason && (!requiresFeedback || additionalFeedback.trim().length > 0)

  if (step === "initial") {
    return (
      <button
        onClick={() => setStep("retention")}
        className={cn(
          "text-sm text-muted-foreground hover:text-destructive hover:underline transition-colors",
          className,
        )}
      >
        Cancel subscription
      </button>
    )
  }

  if (step === "retention") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/95 shadow-2xl animate-in zoom-in-95 duration-300">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>

          <div className="p-8">
            {/* Header with gradient */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600">
                <Sparkles className="size-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Wait! We'd hate to see you go
              </h2>
              <p className="mt-3 text-base text-muted-foreground max-w-xl mx-auto">
                You're a valued member of the MirrorSite community. Before you leave, let's make sure we're giving you everything you need.
              </p>
            </div>

            {/* Your Current Benefits */}
            <div className="mt-8 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-lg bg-primary/10 p-2">
                  <CheckCircle className="size-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Your {planName} Benefits</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg bg-background/50 p-3">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{monthlyCredits.toLocaleString()} Monthly Credits</p>
                    <p className="text-xs text-muted-foreground">Build up to {Math.floor(monthlyCredits / 100)} applications per month</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-background/50 p-3">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <CheckCircle className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Priority Support</p>
                    <p className="text-xs text-muted-foreground">Faster response times for your questions</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-background/50 p-3">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <CheckCircle className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Advanced Features</p>
                    <p className="text-xs text-muted-foreground">Custom domains, environment variables, and more</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-background/50 p-3">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <CheckCircle className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Unlimited Projects</p>
                    <p className="text-xs text-muted-foreground">Build as many applications as you want</p>
                  </div>
                </div>
              </div>
            </div>

            {/* What Happens If You Cancel */}
            <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <h3 className="text-base font-semibold text-destructive mb-3">What happens if you cancel?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <X className="size-4 shrink-0 text-destructive mt-0.5" />
                  <span>You'll lose <strong>{monthlyCredits.toLocaleString()} credits</strong> every month (that's ${priceUSD} worth of value)</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="size-4 shrink-0 text-destructive mt-0.5" />
                  <span>Access to priority support and faster response times</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="size-4 shrink-0 text-destructive mt-0.5" />
                  <span>Advanced features like custom domains and environment variables</span>
                </li>
                <li className="flex items-start gap-2">
                  <X className="size-4 shrink-0 text-destructive mt-0.5" />
                  <span>Your competitive edge in shipping products faster</span>
                </li>
              </ul>
            </div>

            {/* Action Options */}
            <div className="mt-8 space-y-3">
              {/* Option 1: Keep Subscription */}
              <button
                onClick={handleClose}
                className="w-full flex items-center justify-between rounded-xl border-2 border-primary bg-gradient-to-r from-primary to-primary/90 p-4 text-left transition-all hover:shadow-lg hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="size-6 text-primary-foreground" />
                  <div>
                    <p className="font-semibold text-primary-foreground">Keep My {planName} Subscription</p>
                    <p className="text-sm text-primary-foreground/80">Continue enjoying all benefits</p>
                  </div>
                </div>
                <div className="rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-primary-foreground">
                  Recommended
                </div>
              </button>

              {/* Option 2: Downgrade to Cheaper Plan */}
              {cheaperPlans.length > 0 && (
                <button
                  onClick={() => {
                    // Redirect to billing page where they can switch plans
                    router.push("/settings/billing#plans")
                    handleClose()
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <TrendingDown className="size-6 text-primary" />
                    <div>
                      <p className="font-semibold">Switch to a Smaller Plan</p>
                      <p className="text-sm text-muted-foreground">
                        Save money with {cheaperPlans[0].name} (${cheaperPlans[0].priceUSD}/mo)
                        {cheaperPlans.length > 1 && ` or ${cheaperPlans.length - 1} other option${cheaperPlans.length > 2 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Option 3: Cancel Subscription */}
              <button
                onClick={() => setStep("reason")}
                className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-destructive/50 hover:bg-destructive/5"
              >
                <div className="flex items-center gap-3">
                  <X className="size-6 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">I want to cancel my subscription</p>
                    <p className="text-sm text-muted-foreground">We'll miss you, but we understand</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "reason") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/50 bg-card shadow-2xl animate-in zoom-in-95 duration-300">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>

          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold">Help Us Improve</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Your feedback helps us serve you and others better. Please tell us why you're cancelling.
              </p>
            </div>

            <div className="space-y-3">
              {CANCELLATION_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-all hover:border-primary/50 hover:bg-accent/50",
                    selectedReason === reason.value && "border-primary bg-primary/5"
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="mt-1 size-4 text-primary"
                  />
                  <span className="text-sm font-medium flex-1">{reason.label}</span>
                </label>
              ))}
            </div>

            {selectedReason && requiresFeedback && (
              <div className="mt-6">
                <label htmlFor="feedback" className="text-sm font-medium flex items-center gap-2">
                  Tell us more <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  This helps us understand how to improve our service for you and others.
                </p>
                <textarea
                  id="feedback"
                  value={additionalFeedback}
                  onChange={(e) => setAdditionalFeedback(e.target.value)}
                  placeholder="Please share more details about your experience..."
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setStep("retention")}
                disabled={isLoading}
                className="rounded-xl border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  if (selectedReasonData?.hasDiscount) {
                    setStep("discount")
                  } else {
                    setStep("processing")
                  }
                }}
                disabled={!canProceed || isLoading}
                className="rounded-xl bg-destructive px-6 py-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {requiresFeedback && !additionalFeedback.trim() ? "Please provide details" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "discount") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card to-card/95 shadow-2xl animate-in zoom-in-95 duration-300">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>

          <div className="p-8 text-center">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 animate-bounce">
              <Gift className="size-10 text-white" />
            </div>

            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Congratulations! 🎉
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              As one of our valued leading users, we'd like to offer you a special deal:
            </p>

            <div className="mt-8 rounded-2xl border-2 border-green-500/20 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">15% OFF</p>
              <p className="mt-2 text-sm text-foreground">Your Next Plan Renewal</p>

              <div className="mt-6 rounded-xl bg-white dark:bg-gray-900 p-4 border border-green-200 dark:border-green-800">
                <p className="text-xs text-muted-foreground mb-2">Use this code:</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-2xl font-mono font-bold tracking-wider text-green-600 dark:text-green-400">
                    {DISCOUNT_CODE}
                  </code>
                  <button
                    onClick={copyDiscountCode}
                    className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
                  </button>
                </div>
                {copied && (
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                    ✓ Copied to clipboard!
                  </p>
                )}
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                This exclusive code will be automatically applied at your next renewal
              </p>
            </div>

            <div className="mt-8 space-y-3">
              <button
                onClick={handleClose}
                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 text-base font-semibold text-white transition-all hover:shadow-lg hover:scale-[1.02]"
              >
                Awesome! Keep My Subscription
              </button>
              <button
                onClick={() => setStep("processing")}
                className="w-full rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                No thanks, still want to cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "processing") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-amber-500/10">
                <X className="size-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold">Final Confirmation</h3>
            </div>

            <div className="rounded-xl border border-border bg-accent/50 p-4 text-sm">
              <p className="text-muted-foreground">
                Your <strong className="text-foreground">{planName}</strong> subscription will remain active until{" "}
                <strong className="text-foreground">{periodEndDate}</strong>.
              </p>
              <p className="mt-3 text-muted-foreground">
                After that, you'll lose access to {monthlyCredits.toLocaleString()} monthly credits and all premium features.
              </p>
              <p className="mt-3 text-foreground font-medium">
                Any permanent credits you've purchased will remain available.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setStep("reason")}
                disabled={isLoading}
                className="rounded-xl border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="rounded-xl bg-destructive px-6 py-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && (
                  <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {isLoading ? "Cancelling..." : "Yes, Cancel My Subscription"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}