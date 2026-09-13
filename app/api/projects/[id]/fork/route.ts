import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { projectForksCol } from "@/lib/db/collections"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { getAvailableCredits, reserveCredits, releaseReservation, grantCredits } from "@/lib/billing/credit-service"
import { FORK_PRICING, type ForkTier } from "@/lib/billing/config"
import { logger } from "@/lib/logging/logger"
import { ObjectId } from "mongodb"
import type { MirrorProject } from "@/lib/types/project"

/** Resolve the fork pricing tier from the project's specification complexity. */
function getForkTier(project: MirrorProject): ForkTier {
  const c = project.specification?.complexity
  if (c === "complex") return "complex"
  if (c === "medium") return "medium"
  return "simple"
}

/**
 * GET /api/projects/:id/fork
 * Returns fork pricing info for a public project. No auth required.
 * Called by the public project page to display cost + savings before forking.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.visibility !== "public") {
      return fail("NOT_FOUND", "Project not found.", 404)
    }
    const tier = getForkTier(project)
    const pricing = FORK_PRICING[tier]
    return ok({
      tier,
      forkCost: pricing.forkCost,
      ownerRoyalty: pricing.ownerRoyalty,
      savingsPct: pricing.savingsPct,
      complexity: project.specification?.complexity ?? "simple",
    })
  } catch (e) {
    return handleRouteError("api.projects.fork.info", e)
  }
}

/**
 * POST /api/projects/:id/fork
 * Forks a public project into the current user's workspace.
 *
 * Pricing (per FORK_PRICING in billing/config.ts):
 *   simple  → 15,000 credits (saves 45%) — owner earns  5,000
 *   medium  → 45,000 credits (saves 25%) — owner earns 10,000
 *   complex → 50,000 credits (saves 35%) — owner earns 15,000
 *
 * Credit flow:
 *   1. Verify forker has enough balance.
 *   2. Reserve credits from forker.
 *   3. Create the forked project.
 *   4. Record the fork document.
 *   5. Consume the reservation (finalize charge).
 *   6. Grant royalty to original owner (best-effort — never fails the fork).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const reservationId = cryptoId() // used to release on failure
  let reserved = false

  try {
    const user = await requireUser()
    const { id } = await params

    // Rate-limit: 10 forks per hour per user
    await checkRateLimit({
      action: "project_fork",
      identifier: user.id,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })

    const original = await store.getProject(id)
    if (!original) return fail("NOT_FOUND", "Project not found.", 404)
    if (original.visibility !== "public") return fail("NOT_PUBLIC", "You can only fork public projects.", 403)
    if (original.userId === user.id) return fail("OWN_PROJECT", "You already own this project.", 400)

    // If user already forked this project, return existing fork
    const forksCol = await projectForksCol()
    const existing = await forksCol.findOne({ forkedByUserId: user.id, originalProjectId: id })
    if (existing) {
      const existingFork = await store.getProject(existing.forkedProjectId)
      if (existingFork) {
        const tier = getForkTier(original)
        const pricing = FORK_PRICING[tier]
        return ok({
          project: { id: existingFork.id, name: existingFork.name },
          alreadyForked: true,
          tier,
          forkCost: pricing.forkCost,
          savingsPct: pricing.savingsPct,
          message: "You already forked this project — opening it now.",
        })
      }
    }

    // ── Determine tier & pricing ───────────────────────────────────────────────
    const tier = getForkTier(original)
    const pricing = FORK_PRICING[tier]

    // ── Step 1: Balance check ─────────────────────────────────────────────────
    const available = await getAvailableCredits(user.id)
    if (available < pricing.forkCost) {
      return fail(
        "INSUFFICIENT_CREDITS",
        `Forking this ${tier} project costs ${pricing.forkCost.toLocaleString()} credits. You have ${available.toLocaleString()} available.`,
        402,
      )
    }

    // ── Step 2: Reserve credits ───────────────────────────────────────────────
    await reserveCredits({
      userId: user.id,
      amount: pricing.forkCost,
      buildId: reservationId,
      reason: `Fork of "${original.name}" (${tier} tier)`,
      metadata: { action: "fork_purchase", projectId: id, tier },
    })
    reserved = true

    logger.info("api.projects.fork", "credits reserved", {
      userId: user.id, projectId: id, tier, amount: pricing.forkCost,
    })

    // ── Step 3: Create forked project ─────────────────────────────────────────
    const forkedProjectId = cryptoId()
    const forkDocId = cryptoId()
    const now = Date.now()

    const forked: MirrorProject = {
      id: forkedProjectId,
      userId: user.id,
      mode: original.mode,
      name: `${original.name} (fork)`,
      state: "specification_ready",
      sourceUrl: original.sourceUrl,
      crawlMode: original.crawlMode,
      pipelineMode: original.pipelineMode,
      idea: original.idea,
      understanding: original.understanding,
      specification: original.specification,
      preferences: original.preferences,
      visibility: "private",
      events: [{
        id: cryptoId(),
        at: now,
        level: "info",
        stage: "fork",
        message: `Forked from "${original.name}" (${tier} tier) — ${pricing.forkCost.toLocaleString()} credits, saves you ${pricing.savingsPct}% vs building from scratch`,
      }],
      conversation: [],
      deployment: { id: cryptoId(), status: "idle", updatedAt: now },
      deploymentHistory: [],
      createdAt: now,
      updatedAt: now,
    }

    await store.createProject(forked)

    // ── Step 4: Record fork document ──────────────────────────────────────────
    await forksCol.insertOne({
      _id: new ObjectId(),
      id: forkDocId,
      originalProjectId: id,
      originalUserId: original.userId,
      forkedProjectId,
      forkedByUserId: user.id,
      createdAt: now,
    })

    // ── Step 5: Consume the reservation (finalize charge) ─────────────────────
    // Release = converts reserved → consumed. On failure here, credits stay
    // reserved (not lost) and we log it — the project is still usable.
    try {
      await releaseReservation({
        userId: user.id,
        amount: pricing.forkCost,
        buildId: reservationId,
        reason: `Fork finalized: "${original.name}" (${tier})`,
      })
      reserved = false // consumed, no longer needs cleanup
    } catch (consumeErr) {
      logger.error("api.projects.fork", "reservation finalization failed (non-fatal)", {
        userId: user.id, reservationId, error: (consumeErr as Error).message,
      })
    }

    // ── Step 6: Grant royalty to original owner (best-effort) ─────────────────
    try {
      await grantCredits({
        userId: original.userId,
        creditType: "permanent",
        amount: pricing.ownerRoyalty,
        transactionType: "fork_royalty",
        idempotencyKey: `fork_royalty:${forkDocId}`,
        referenceType: "fork",
        referenceId: forkDocId,
        metadata: {
          forkedByUserId: user.id,
          projectId: id,
          projectName: original.name,
          tier,
          forkCost: pricing.forkCost,
        },
      })
      logger.info("api.projects.fork", "royalty granted to owner", {
        ownerId: original.userId, projectId: id, tier, royalty: pricing.ownerRoyalty,
      })
    } catch (royaltyErr) {
      // Non-fatal — fork already complete, owner just misses the royalty this time
      logger.error("api.projects.fork", "royalty grant failed (non-fatal)", {
        ownerId: original.userId, projectId: id, error: (royaltyErr as Error).message,
      })
    }

    return ok({
      project: { id: forkedProjectId, name: forked.name },
      alreadyForked: false,
      tier,
      forkCost: pricing.forkCost,
      ownerRoyalty: pricing.ownerRoyalty,
      savingsPct: pricing.savingsPct,
      message: `Forked! ${pricing.forkCost.toLocaleString()} credits charged. Saves you ${pricing.savingsPct}% vs building from scratch.`,
    }, { status: 201 })

  } catch (e) {
    // If we reserved credits but something went wrong creating the project, refund
    if (reserved) {
      try {
        await releaseReservation({
          userId: (await requireUser().catch(() => null))?.id ?? "unknown",
          amount: 0, // amount is looked up by buildId
          buildId: reservationId,
          reason: "Fork failed — refunding reservation",
        })
      } catch (refundErr) {
        logger.error("api.projects.fork", "refund after failure failed", {
          reservationId, error: (refundErr as Error).message,
        })
      }
    }
    return handleRouteError("api.projects.fork", e)
  }
}
