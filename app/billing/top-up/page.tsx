import { redirect } from "next/navigation"

/**
 * Legacy top-up page — redirects to the new billing page.
 * Mobile Money / MTN / Airtel top-ups are no longer available.
 * All payments now go through Dodo Payments.
 */
export default function TopUpPage() {
  redirect("/settings/billing")
}
