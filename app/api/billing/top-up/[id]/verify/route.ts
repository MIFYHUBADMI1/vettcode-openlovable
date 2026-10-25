import { fail } from "@/lib/api/respond"

/**
 * @deprecated Legacy top-up API.
 * Mobile Money payments are no longer accepted.
 * All payments now go through Dodo Payments at /api/billing/webhook.
 */

/** Retry payment verification — DISABLED. Cannot award credits. */
export async function POST() {
  return fail(
    "DEPRECATED",
    "Mobile Money top-ups are no longer supported. Please use Dodo Payments to purchase credits at /settings/billing.",
    410,
  )
}
