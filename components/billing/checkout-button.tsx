"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface CheckoutButtonProps {
  /** 'subscription' or 'permanent' */
  type: "subscription" | "permanent"
  /** Plan ID (for subscriptions) or pack ID (for permanent credits) */
  productId: string
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

/**
 * Initiates a Dodo Payments checkout session and redirects the user.
 *
 * Flow:
 * 1. POST to /api/billing/checkout with product details
 * 2. Receive checkout_url from Dodo
 * 3. Redirect user to Dodo hosted checkout
 * 4. After payment, Dodo sends webhook → we grant credits
 */
export function CheckoutButton({
  type,
  productId,
  children,
  className,
  disabled = false,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    if (loading || disabled) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, productId }),
      })

      const json = await res.json()

      if (json.ok && json.data?.checkoutUrl) {
        // Keep loading=true — user will be navigated away
        window.location.href = json.data.checkoutUrl
      } else {
        const msg = json.error?.message ?? "Failed to start checkout. Please try again."
        setError(msg)
        setLoading(false)
      }
    } catch {
      setError("Network error. Please check your connection and try again.")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleCheckout}
        disabled={loading || disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
      >
        {loading ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Redirecting...
          </>
        ) : (
          children
        )}
      </button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
