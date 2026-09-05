import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { getBuildCost } from "@/lib/billing/build-auth"
import { reserveCredits, releaseReservation, getAvailableCredits } from "@/lib/billing/credit-service"
import { classifyComplexity } from "@/lib/credits/credits"
import { runAgent, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import type { BuildRun, ConversationMessage } from "@/lib/types/project"

/**
 * Sends a follow-up development prompt to the Totalum agent (spec section 16).
 * Same credit discipline as the initial build: reserve, launch, refund on
 * failure. The user's prompt is stored in the project conversation.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const userId = user.id
    const { id } = await params

    // Rate-limit agent follow-ups: 20 per hour per user.
    await checkRateLimit({
      action: "project_agent",
      identifier: userId,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })

    const project = await store.getProject(id)
    if (!project || project.userId !== userId) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("VALIDATION", "This project hasn't been built yet.", 409)
    // Fast-path check for a friendlier error; the actual guard against a
    // duplicate concurrent run is the atomic `claimBuildSlot` call below.
    if (project.state === "building" || project.state === "deploying") {
      return fail("AGENT_RUNNING", "Please wait for the current change to finish.", 409)
    }

    const body = (await req.json().catch(() => ({}))) as { prompt?: string }
    const prompt = (body.prompt ?? "").trim()
    if (prompt.length < 2) return fail("VALIDATION", "Please describe the change you want.", 422)

    if (!isTotalumConfigured()) {
      return fail("PROVIDER_NOT_CONFIGURED", "The application builder isn't connected yet.", 503)
    }

    const userMsg: ConversationMessage = { id: cryptoId(), role: "user", content: prompt, at: Date.now() }
    await store.appendMessage(id, userMsg)

    // Determine the credit cost based on the project's complexity tier,
    // matching the initial build cost — not a flat follow-up rate.
    const tier = project.specification?.complexity ?? classifyComplexity(project.specification!)
    const creditsNeeded = getBuildCost(tier)

    const run: BuildRun = {
      id: cryptoId(),
      userId,
      mirrorProjectId: id,
      totalumProjectId: project.totalumProjectId,
      kind: "followup",
      prompt,
      status: "reserved",
      startedAt: Date.now(),
      creditsReserved: creditsNeeded,
    }
    await store.createBuildRun(run)

    // Atomically claim the build slot. This is the real guard against a
    // duplicate concurrent run — it can only succeed once per project while
    // state is outside {building, deploying} (see claimBuildSlot), closing
    // the check-then-act window the earlier state check above left open
    // between two simultaneous requests.
    const claimed = await store.claimBuildSlot(id, { state: "building" })
    if (!claimed) {
      await store.updateBuildRun(run.id, { status: "failed", error: "build already in progress" })
      return fail("AGENT_RUNNING", "Please wait for the current change to finish.", 409)
    }

    // Pre-flight balance check for a friendlier error message before reserving.
    const available = await getAvailableCredits(userId)
    if (available < creditsNeeded) {
      await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
      await store.updateProject(id, { state: project.state })
      return fail("INSUFFICIENT_CREDITS", `You need ${creditsNeeded.toLocaleString()} credits for this edit (${tier} tier). Available: ${available.toLocaleString()}.`, 402)
    }

    const reserved = await reserveCredits({
      userId,
      amount: creditsNeeded,
      buildId: run.id,
      reason: `${tier.charAt(0).toUpperCase() + tier.slice(1)} application follow-up`,
    })
    if (!reserved) {
      await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
      await store.updateProject(id, { state: project.state })
      return fail("INSUFFICIENT_CREDITS", `You need ${creditsNeeded.toLocaleString()} credits for this edit (${tier} tier). Please top up and try again.`, 402)
    }

    const previousState = project.state
    try {
      await runAgent(project.totalumProjectId, prompt)
      await store.updateBuildRun(run.id, { status: "running" })
      await store.updateProject(id, { state: "building" })
      return ok({ buildRunId: run.id, state: "building", creditsCharged: creditsNeeded, tier })
    } catch (providerError) {
      await releaseReservation({ userId, amount: creditsNeeded, buildId: run.id, reason: "Agent provider failure" })
      await store.updateBuildRun(run.id, { status: "failed", error: (providerError as Error).message })
      await store.updateProject(id, { state: previousState })
      throw providerError
    }
  } catch (e) {
    return handleRouteError("api.projects.agent", e)
  }
}
