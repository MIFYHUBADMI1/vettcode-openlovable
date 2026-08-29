import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { estimateFollowup, reserveCredits, refundReservation } from "@/lib/credits/credits"
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

    const estimate = estimateFollowup()
    const run: BuildRun = {
      id: cryptoId(),
      userId,
      mirrorProjectId: id,
      totalumProjectId: project.totalumProjectId,
      kind: "followup",
      prompt,
      status: "reserved",
      startedAt: Date.now(),
      creditsReserved: estimate.reserve,
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

    const reserved = await reserveCredits(userId, estimate.reserve, run.id, "AI development prompt")
    if (!reserved) {
      await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
      await store.updateProject(id, { state: project.state })
      return fail("INSUFFICIENT_CREDITS", "You don't have enough credits for this change.", 402)
    }

    try {
      await runAgent(project.totalumProjectId, prompt)
      await store.updateBuildRun(run.id, { status: "running" })
      await store.updateProject(id, { state: "building" })
      return ok({ buildRunId: run.id, state: "building" })
    } catch (providerError) {
      await refundReservation(userId, estimate.reserve, run.id)
      await store.updateBuildRun(run.id, { status: "failed", error: (providerError as Error).message })
      throw providerError
    }
  } catch (e) {
    return handleRouteError("api.projects.agent", e)
  }
}
