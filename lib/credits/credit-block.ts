import "server-only"
import { store } from "@/lib/store/store"
import { getAvailableCredits } from "@/lib/billing/credit-service"

/**
 * Record that a background run stopped for lack of credits, so the credit gate
 * can show the same top-up overlay a synchronous 402 would have raised.
 *
 * Best-effort by design: a shortfall notice must never be the reason the run
 * itself fails, and the pipeline still writes its own event/failure message.
 * Nothing clears the record — a gap the founder has already closed is dropped
 * when it is read (see `sanitizeCreditBlock`) and goes stale on its own.
 */
export async function recordCreditBlock(
  projectId: string,
  userId: string,
  input: { required: number; action: string },
): Promise<void> {
  try {
    const available = await getAvailableCredits(userId)
    const required = Math.max(0, Math.round(input.required))
    if (available >= required) return
    await store.updateProject(projectId, {
      creditBlock: { required, available, action: input.action, at: Date.now() },
    })
  } catch {
    /* the project may be gone, or the balance unreadable — either way the
       founder still sees the pipeline's own failure message */
  }
}
