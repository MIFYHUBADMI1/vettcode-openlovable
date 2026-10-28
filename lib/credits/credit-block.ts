import "server-only"
import { store } from "@/lib/store/store"
import { getAvailableCredits } from "@/lib/billing/credit-service"

// A background refusal has no HTTP response, so the workspace poll carries it.
export async function recordCreditBlock(
  projectId: string,
  userId: string,
  input: { required: number; action: string; resume: "build" | "analysis" },
): Promise<void> {
  try {
    const available = await getAvailableCredits(userId)
    const required = Math.max(0, Math.round(input.required))
    if (available >= required) return
    await store.updateProject(projectId, {
      creditBlock: { required, available, action: input.action, at: Date.now(), resume: input.resume },
    })
  } catch {
    /* the project may be gone, or the balance unreadable — either way the
       founder still sees the pipeline's own failure message */
  }
}
