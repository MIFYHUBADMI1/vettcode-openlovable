import { getAvailableCredits } from "@/lib/billing/credit-service"
import { failInsufficientCredits } from "@/lib/api/respond"

/**
 * Refuse an action for lack of credits, reading the live balance so the caller
 * only has to say what the action costs.
 *
 * Routes that already read `available` should call `failInsufficientCredits`
 * directly instead of paying for a second read.
 */
export async function refuseInsufficientCredits(
  userId: string,
  required: number,
  message?: string,
) {
  const available = await getAvailableCredits(userId)
  return failInsufficientCredits({ required, available, message })
}
