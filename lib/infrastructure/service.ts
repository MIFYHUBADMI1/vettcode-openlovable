import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { projectsCol, usersCol, creditTransactionsCol, ensureIndexes } from "@/lib/db/collections"
import { getInfrastructurePlan, type InfrastructurePlanId } from "@/lib/infrastructure/plans"
import { setProjectCreditLimits } from "@/lib/integrations/totalum/service"
import { logger } from "@/lib/logging/logger"
import type { InfrastructureSubscription, MirrorProject } from "@/lib/types/project"

/**
 * Infrastructure plan management service.
 *
 * Responsibilities:
 * - Apply infrastructure plans to projects
 * - Synchronize Totalum project credit caps
 * - Handle plan activation, upgrades, downgrades, and expiration
 * - Record credit transactions for plan purchases
 */

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/** Default plan for new projects. */
const DEFAULT_PLAN: InfrastructurePlanId = "testing"

/**
 * Initialize the infrastructure subscription for a new project.
 * Called immediately after Totalum project creation.
 * The Totalum cap is applied during project creation via launchProject.
 */
export async function initializeProjectInfrastructure(
  projectId: string,
  totalumProjectId: string,
): Promise<void> {
  const plan = getInfrastructurePlan(DEFAULT_PLAN)
  if (!plan) throw new Error("Default infrastructure plan not found")

  const now = Date.now()
  const subscription: InfrastructureSubscription = {
    planId: plan.id,
    planName: plan.name,
    storageLimitBytes: plan.storageBytes,
    totalumInfrastructureCreditLimit: plan.totalumInfrastructureCredits,
    status: "active",
    startedAt: now,
    expiresAt: now + MONTH_MS, // Testing plan expires in 1 month
    autoRenew: false,
    totalumCreditsUsed: 0,
    storageUsedBytes: 0,
    overQuota: false,
    syncStatus: "synced",
  }

  const col = await projectsCol()
  await col.updateOne(
    { id: projectId },
    { $set: { infrastructure: subscription, updatedAt: now } },
  )

  logger.info("infrastructure.init", "project infrastructure initialized", {
    projectId,
    totalumProjectId,
    planId: plan.id,
    totalumCap: plan.totalumInfrastructureCredits,
  })
}

/**
 * Apply an infrastructure cap to a Totalum project.
 * Used during initial creation and when plans change.
 * The cap is set via the Totalum PATCH /credit-limits endpoint.
 */
export async function applyTotalumCap(
  totalumProjectId: string,
  infrastructureCreditLimit: number,
): Promise<void> {
  try {
    await setProjectCreditLimits(totalumProjectId, {
      maxInfrastructureCreditsPerMonth: infrastructureCreditLimit,
    })
    logger.info("infrastructure.cap", "Totalum cap applied", {
      totalumProjectId,
      cap: infrastructureCreditLimit,
    })
  } catch (e) {
    logger.error("infrastructure.cap", "failed to apply Totalum cap", {
      totalumProjectId,
      cap: infrastructureCreditLimit,
      error: (e as Error).message,
    })
    throw e
  }
}

/**
 * Activate a new infrastructure plan for a project.
 * Handles credit deduction, plan update, and Totalum cap synchronization.
 * Idempotent — safe to call multiple times.
 */
export async function activatePlan(
  projectId: string,
  userId: string,
  planId: InfrastructurePlanId,
): Promise<{ success: boolean; message: string }> {
  await ensureIndexes()

  const plan = getInfrastructurePlan(planId)
  if (!plan) return { success: false, message: "Invalid plan." }
  if (plan.id === "enterprise") return { success: false, message: "Enterprise plans require manual setup. Please contact support." }

  const col = await projectsCol()
  const project = await col.findOne({ id: projectId }) as MirrorProject | null
  if (!project) return { success: false, message: "Project not found." }
  if (project.userId !== userId) return { success: false, message: "Unauthorized." }
  if (!project.totalumProjectId) return { success: false, message: "Project must be built before upgrading infrastructure." }

  const current = project.infrastructure
  const now = Date.now()

  // Check if already on this plan and active
  if (current?.planId === plan.id && current?.status === "active" && (current?.expiresAt ?? 0) > now) {
    return { success: false, message: `You are already on the ${plan.name} plan.` }
  }

  // For paid plans, deduct credits
  if (plan.isPaid && plan.mirrorSitePrice > 0) {
    // Check balance
    const balance = await store.getBalance(userId)
    if (balance < plan.mirrorSitePrice) {
      return { success: false, message: `Insufficient credits. You need ${plan.mirrorSitePrice.toLocaleString()} credits for the ${plan.name} plan.` }
    }

    // Deduct credits directly — bypass MongoDB sessions which fail on standalone instances
    const txId = cryptoId()
    const usersCollection = await usersCol()
    const txCol = await creditTransactionsCol()
    const { ObjectId } = await import("mongodb")

    // First: atomically check balance and deduct in one operation
    const result = await usersCollection.findOneAndUpdate(
      { id: userId, credits: { $gte: plan.mirrorSitePrice } },
      { $inc: { credits: -plan.mirrorSitePrice }, $set: { updatedAt: now } },
      { returnDocument: "after" },
    )
    if (!result) {
      return { success: false, message: `Insufficient credits. You need ${plan.mirrorSitePrice.toLocaleString()} credits for the ${plan.name} plan.` }
    }

    // Second: record the transaction (non-critical — if this fails, the money is still deducted)
    await txCol.insertOne({
      _id: new ObjectId(),
      id: txId,
      userId,
      type: "deduction",
      amount: -plan.mirrorSitePrice,
      reason: `Infrastructure plan: ${plan.name} — ${plan.storageLabel}`,
      createdAt: now,
    }).catch((e) => {
      logger.error("infrastructure.activate", "failed to record transaction", { userId, txId, error: (e as Error).message })
    })

    // Update project infrastructure
    const subscription: InfrastructureSubscription = {
      planId: plan.id,
      planName: plan.name,
      storageLimitBytes: plan.storageBytes,
      totalumInfrastructureCreditLimit: plan.totalumInfrastructureCredits,
      status: "active",
      startedAt: now,
      expiresAt: now + MONTH_MS,
      autoRenew: false,
      totalumCreditsUsed: 0,
      storageUsedBytes: current?.storageUsedBytes ?? 0,
      overQuota: false,
      syncStatus: "pending",
    }

    await col.updateOne(
      { id: projectId },
      { $set: { infrastructure: subscription, updatedAt: now } },
    )

    // Apply Totalum cap
    try {
      await applyTotalumCap(project.totalumProjectId, plan.totalumInfrastructureCredits)
      await col.updateOne(
        { id: projectId, "infrastructure.planId": plan.id },
        { $set: { "infrastructure.syncStatus": "synced", updatedAt: now } },
      )
    } catch (e) {
      // Cap update failed — mark as pending for retry
      await col.updateOne(
        { id: projectId, "infrastructure.planId": plan.id },
        { $set: { "infrastructure.syncStatus": "failed", updatedAt: now } },
      )
      logger.error("infrastructure.activate", "Totalum cap update failed after payment", {
        projectId,
        totalumProjectId: project.totalumProjectId,
        error: (e as Error).message,
      })
      // Don't fail the activation — the payment was made, cap will be retried
    }

    logger.info("infrastructure.activate", "plan activated", {
      projectId,
      planId: plan.id,
      price: plan.mirrorSitePrice,
      totalumCap: plan.totalumInfrastructureCredits,
    })

    return { success: true, message: `${plan.name} plan activated successfully.` }
  }

  // Free plan (testing) — just activate
  const subscription: InfrastructureSubscription = {
    planId: plan.id,
    planName: plan.name,
    storageLimitBytes: plan.storageBytes,
    totalumInfrastructureCreditLimit: plan.totalumInfrastructureCredits,
    status: "active",
    startedAt: now,
    expiresAt: now + MONTH_MS,
    autoRenew: false,
    totalumCreditsUsed: current?.totalumCreditsUsed ?? 0,
    storageUsedBytes: current?.storageUsedBytes ?? 0,
    overQuota: false,
    syncStatus: "pending",
  }

  await col.updateOne(
    { id: projectId },
    { $set: { infrastructure: subscription, updatedAt: now } },
  )

  // Apply Totalum cap
  try {
    await applyTotalumCap(project.totalumProjectId, plan.totalumInfrastructureCredits)
    await col.updateOne(
      { id: projectId, "infrastructure.planId": plan.id },
      { $set: { "infrastructure.syncStatus": "synced", updatedAt: now } },
    )
  } catch (e) {
    await col.updateOne(
      { id: projectId, "infrastructure.planId": plan.id },
      { $set: { "infrastructure.syncStatus": "failed", updatedAt: now } },
    )
    logger.error("infrastructure.activate", "Totalum cap update failed", {
      projectId,
      error: (e as Error).message,
    })
  }

  logger.info("infrastructure.activate", "free plan activated", {
    projectId,
    planId: plan.id,
  })

  return { success: true, message: `${plan.name} plan activated.` }
}

/**
 * Handle subscription expiration.
 * Downgrades to Testing plan and updates Totalum cap.
 */
export async function handleExpiration(projectId: string): Promise<void> {
  const col = await projectsCol()
  const project = await col.findOne({ id: projectId }) as MirrorProject | null
  if (!project?.infrastructure) return
  if (project.infrastructure.status !== "active") return

  const now = Date.now()
  if (project.infrastructure.expiresAt > now) return

  // Expire the current subscription
  await col.updateOne(
    { id: projectId },
    { $set: { "infrastructure.status": "expired", updatedAt: now } },
  )

  // Downgrade to Testing
  if (project.totalumProjectId) {
    const testingPlan = getInfrastructurePlan(DEFAULT_PLAN)
    if (testingPlan) {
      try {
        await applyTotalumCap(project.totalumProjectId, testingPlan.totalumInfrastructureCredits)
      } catch (e) {
        logger.error("infrastructure.expiration", "failed to downgrade Totalum cap", {
          projectId,
          error: (e as Error).message,
        })
      }

      const subscription: InfrastructureSubscription = {
        planId: testingPlan.id,
        planName: testingPlan.name,
        storageLimitBytes: testingPlan.storageBytes,
        totalumInfrastructureCreditLimit: testingPlan.totalumInfrastructureCredits,
        status: "active",
        startedAt: now,
        expiresAt: now + MONTH_MS,
        autoRenew: false,
        totalumCreditsUsed: 0,
        storageUsedBytes: project.infrastructure.storageUsedBytes ?? 0,
        overQuota: (project.infrastructure.storageUsedBytes ?? 0) > testingPlan.storageBytes,
        syncStatus: "synced",
      }

      await col.updateOne(
        { id: projectId },
        { $set: { infrastructure: subscription, updatedAt: now } },
      )

      logger.info("infrastructure.expiration", "downgraded to testing", {
        projectId,
        previousPlan: project.infrastructure.planId,
      })
    }
  }
}

/**
 * Get the infrastructure subscription for a project.
 * Returns null if no subscription exists (legacy projects).
 */
export async function getProjectInfrastructure(projectId: string): Promise<InfrastructureSubscription | null> {
  const col = await projectsCol()
  const project = await col.findOne({ id: projectId }) as MirrorProject | null
  return project?.infrastructure ?? null
}

/**
 * Check if a project has exceeded its storage limit.
 */
export async function checkStorageLimit(projectId: string): Promise<{ withinLimit: boolean; used: number; limit: number }> {
  const infra = await getProjectInfrastructure(projectId)
  if (!infra) return { withinLimit: true, used: 0, limit: Infinity }
  return {
    withinLimit: (infra.storageUsedBytes ?? 0) < infra.storageLimitBytes,
    used: infra.storageUsedBytes ?? 0,
    limit: infra.storageLimitBytes,
  }
}
