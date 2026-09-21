import { z } from "zod"
import { requireUser } from "@/lib/auth/session"
import { fail, handleRouteError, ok } from "@/lib/api/respond"
import { syncDodoSubscription } from "@/lib/billing/activate-subscription"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { logger } from "@/lib/logging/logger"

const Body = z.object({
  subscriptionId: z.string().min(8).max(120),
})

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    await checkRateLimit({
      action: "billing_sync",
      identifier: user.id,
      limit: 8,
      windowMs: 60 * 1000,
      errorCode: "RATE_LIMITED",
    })

    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) {
      return fail("INVALID_REQUEST", "A valid subscription id is required.", 400)
    }

    const result = await syncDodoSubscription(parsed.data.subscriptionId, user.id)
    logger.info("api.billing.sync", "checkout return sync", {
      userId: user.id,
      subscriptionId: parsed.data.subscriptionId,
      result,
    })
    if (!result.ok) {
      return ok({ recorded: false, reason: result.reason })
    }
    return ok({ recorded: true, planId: result.planId })
  } catch (e) {
    return handleRouteError("api.billing.sync", e)
  }
}
