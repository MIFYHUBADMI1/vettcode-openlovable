"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, X, Zap, TrendingUp, Shield, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface CancelSubscriptionButtonProps {
  planName: string
  periodEnd: number
  monthlyCredits: number
  priceUSD: number
  className?: string
}

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Too expensive for my needs" },
  { value: "not_using_enough", label: "Not using it enough" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "switching_competitor", label: "Switching to a competitor" },
  { value: "technical_issues", label: "Experiencing technical issues" },
  { value: "temporary_pause", label: "Need a temporary break" },
  { value: "project_completed", label: "Project completed" },
  { value: "other", label: "Other reason" },
]

export function CancelSubscriptionButton({
  planName,
  periodEnd,
  monthlyCredits,
  priceUSD,
  className,
}: CancelSubscriptionButtonProps) {
  const router = useRouter()
  const [step, setStep] = useState<"initial" | "retention" | "reason" | "final">("initial")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>("")
  const [additionalFeedback, setAdditionalFeedback] = useState("")

  const periodEndDate = new Date(periodEnd).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const handleCancel = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // First, save the cancellation reason
      await fetch("/api/billing/subscription/cancel-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason,
          feedback: additionalFeedback,
          planName,
        }),
      })

      // Then, cancel the subscription
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription")
      }

      // Refresh the page to show updated status
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
  }

  if (step === "initial") {
    return (
      <button
        onClick={() => setStep("retention")}
        className={cn(
          "text-sm text-muted-foreground hover:text-destructive hover:underline",
          className,
        )}
      >
        Cancel subscription
      </button>
    )
  }

  if (step === "retention") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>

          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-500/10 p-2">
                <AlertCircle className="size-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">
                  Wait! Are you sure you want to cancel?
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Before you go, here's what you'll be missing out on...
                </p>
              </div>
            </div>

            {/* What You'll Lose Section */}
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <h3 className="font-semibold text-destructive flex items-center gap-2">
                  <X className="size-5" />
                  What You'll Lose
                </h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span><strong>{monthlyCredits.toLocaleString()} monthly credits</strong> ({priceUSD > 0 ? `worth $${priceUSD}` : "included"}) - that's {Math.floor(monthlyCredits / 100)} builds per month!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span><strong>Priority support</strong> - faster response times for your questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span><strong>Advanced features</strong> - custom domains, environment variables, and more</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span><strong>Unlimited projects</strong> - build as many apps as you want</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span><strong>Your competitive edge</strong> - ship faster than your competition</span>
                  </li>
                </ul>
              </div>

              {/* Why Stay Section */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <CheckCircle className="size-5" />
                  Why Our Users Love {planName}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 text-sm">
                    <Zap className="size-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <strong>10x Faster Development</strong>
                      <p className="text-xs text-muted-foreground">Ship projects in hours, not weeks</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <TrendingUp className="size-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <strong>Proven ROI</strong>
                      <p className="text-xs text-muted-foreground">Save thousands in development costs</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Shield className="size-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <strong>Production Ready</strong>
                      <p className="text-xs text-muted-foreground">Enterprise-grade infrastructure</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <Zap className="size-4 shrink-0 text-primary mt-0.5" />
                    <div>
                      <strong>Continuous Updates</strong>
                      <p className="text-xs text-muted-foreground">New features added monthly</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special Offer Section */}
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <h3 className="font-semibold text-green-600 dark:text-green-400">
                  💡 Consider This Instead
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Not using all your credits? That's okay! Your unused credits roll over, and you can always pause builds when you don't need them. Plus, you can downgrade to a lower plan instead of cancelling completely.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setStep("reason")}
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                I still want to cancel
              </button>
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <CheckCircle className="size-4" />
                Keep My Subscription
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "reason") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>

          <div className="p-6">
            <h2 className="text-xl font-semibold">Help Us Improve</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We're sorry to see you go. Please tell us why you're cancelling so we can make MirrorSite better.
            </p>

            <div className="mt-6 space-y-3">
              {CANCELLATION_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent",
                    selectedReason === reason.value && "border-primary bg-primary/5",
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="size-4"
                  />
                  <span className="text-sm">{reason.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <label htmlFor="feedback" className="text-sm font-medium">
                Additional feedback (optional)
              </label>
              <textarea
                id="feedback"
                value={additionalFeedback}
                onChange={(e) => setAdditionalFeedback(e.target.value)}
                placeholder="Tell us more about your experience..."
                rows={4}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setStep("retention")}
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={() => setStep("final")}
                disabled={!selectedReason || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                Continue to Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "final") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="relative w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 shrink-0 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  Final Confirmation
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your {planName} subscription will remain active until{" "}
                  <strong>{periodEndDate}</strong>. After that, you'll lose access to:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• {monthlyCredits.toLocaleString()} monthly credits</li>
                  <li>• Priority support</li>
                  <li>• Advanced features</li>
                  <li>• Unlimited projects</li>
                </ul>
                <p className="mt-3 text-sm font-medium text-foreground">
                  Any permanent credits you've purchased will remain available.
                </p>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setStep("reason")}
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isLoading && <Loader2 className="size-4 animate-spin" />}
                {isLoading ? "Cancelling..." : "Yes, Cancel Subscription"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}