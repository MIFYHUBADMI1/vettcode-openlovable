/**
 * MirrorSite AI — Build Authorization Service
 *
 * Manages the RESERVE → EXECUTE → FINALIZE flow for build credit management.
 * Before starting a chargeable build, a BuildAuthorization is created.
 *
 * @module lib/billing/build-auth
 */

import "server-only"
import { ObjectId } from "mongodb"
import { buildAuthorizationsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"
import {
  BUILD_TIERS,
  CREDITS_PER_BASELINE_UNIT,
  PRICING_MODEL_VERSION,
  COST_MODEL_VERSION,
} from "./config"
import { getBalance, consumeCredits, releaseReservation } from "./credit-service"
import type { BuildAuthorization } from "./billing-types"
import type { BuildAuthorizationStatus } from "./config"

// ─── Authorization Creation ──────────────────────────────────────────────────

/**
 * Get the credit cost for a build complexity tier.
 * Server-side authoritative — never trust the client.
 */
export function getBuildCost(complexity: string): number {
  return BUILD_TIERS[complexity]?.credits ?? BUILD_TIERS.medium.credits
}

/**
 * Create a build authorization. This is the first step before a build.
 * Does NOT consume credits yet — only checks and records intent.
 */
export async function createBuildAuthorization(params: {
  userId: string
  projectId: string
  buildId: string
  complexity: "simple" | "medium" | "complex"
}): Promise<{
  authorized: boolean
  authorization?: BuildAuthorization
  error?: string
}> {
  const creditCost = getBuildCost(params.complexity)
  const baselineUnits = Math.floor(creditCost / CREDITS_PER_BASELINE_UNIT)
  const balance = await getBalance(params.userId)

  if (balance.total < creditCost) {
    return {
      authorized: false,
      error: `Insufficient credits. Required: ${creditCost.toLocaleString()}, Available: ${balance.total.toLocaleString()}`,
    }
  }

  const now = Date.now()
  const auth: BuildAuthorization = {
    _id: new ObjectId(),
    id: `bauth_${cryptoId()}`,
    userId: params.userId,
    projectId: params.projectId,
    buildId: params.buildId,
    complexity: params.complexity,
    creditCost,
    baselineUnits,
    pricingModelVersion: PRICING_MODEL_VERSION,
    costModelVersion: COST_MODEL_VERSION,
    availableSubscriptionCredits: balance.subscription,
    availablePermanentCredits: balance.permanent,
    status: "authorized",
    subscriptionCreditsUsed: 0,
    permanentCreditsUsed: 0,
    createdAt: now,
    expiresAt: now + 30 * 60 * 1000, // 30 minutes
  }

  const col = await buildAuthorizationsCol()
  await col.insertOne(auth)

  logger.info("build_auth.create", "Build authorization created", {
    authId: auth.id,
    userId: params.userId,
    projectId: params.projectId,
    complexity: params.complexity,
    creditCost,
  })

  return { authorized: true, authorization: auth }
}

/**
 * Reserve credits for an authorized build. This actually debits credits.
 */
export async function reserveBuildCredits(
  authorizationId: string,
): Promise<{ success: boolean; error?: string }> {
  const col = await buildAuthorizationsCol()
  const auth = await col.findOne({ id: authorizationId })

  if (!auth) return { success: false, error: "Authorization not found" }
  if (auth.status !== "authorized") {
    return { success: false, error: `Authorization is in status: ${auth.status}` }
  }
  if (Date.now() > auth.expiresAt) {
    await col.updateOne({ id: authorizationId }, { $set: { status: "expired" } })
    return { success: false, error: "Authorization has expired" }
  }

  // Actually consume credits
  const result = await consumeCredits({
    userId: auth.userId,
    amount: auth.creditCost,
    transactionType: "build_reservation",
    idempotencyKey: `reserve_${auth.buildId}`,
    referenceType: "build_authorization",
    referenceId: auth.id,
    metadata: {
      projectId: auth.projectId,
      complexity: auth.complexity,
      creditCost: auth.creditCost,
      baselineUnits: auth.baselineUnits,
    },
  })

  if (!result.success) {
    return { success: false, error: "Failed to reserve credits" }
  }

  // Update authorization status
  await col.updateOne(
    { id: authorizationId },
    {
      $set: {
        status: "reserved",
        subscriptionCreditsUsed: result.subscriptionConsumed,
        permanentCreditsUsed: result.permanentConsumed,
      },
    },
  )

  logger.info("build_auth.reserve", "Build credits reserved", {
    authId: authorizationId,
    creditCost: auth.creditCost,
    subscriptionConsumed: result.subscriptionConsumed,
    permanentConsumed: result.permanentConsumed,
  })

  return { success: true }
}

/**
 * Finalize a build authorization after successful build.
 * Changes status to "finalized" — credits are already consumed.
 */
export async function finalizeBuildAuthorization(
  authorizationId: string,
): Promise<boolean> {
  const col = await buildAuthorizationsCol()
  const result = await col.updateOne(
    { id: authorizationId, status: "reserved" },
    { $set: { status: "finalized", finalizedAt: Date.now() } },
  )

  if (result.modifiedCount > 0) {
    logger.info("build_auth.finalize", "Build authorization finalized", {
      authId: authorizationId,
    })
    return true
  }
  return false
}

/**
 * Release a build authorization (refund credits for failed/cancelled builds).
 */
export async function releaseBuildAuthorization(
  authorizationId: string,
  reason: string,
): Promise<boolean> {
  const col = await buildAuthorizationsCol()
  const auth = await col.findOne({ id: authorizationId })

  if (!auth) return false
  if (auth.status !== "reserved" && auth.status !== "authorized") {
    return false
  }

  // If credits were reserved, release them
  if (auth.status === "reserved") {
    await releaseReservation({
      userId: auth.userId,
      amount: auth.creditCost,
      buildId: auth.buildId,
      reason,
      metadata: { authorizationId },
    })
  }

  await col.updateOne(
    { id: authorizationId },
    { $set: { status: "released" } },
  )

  logger.info("build_auth.release", "Build authorization released", {
    authId: authorizationId,
    reason,
  })

  return true
}

/**
 * Get a build authorization by ID.
 */
export async function getBuildAuthorization(
  authorizationId: string,
): Promise<BuildAuthorization | null> {
  const col = await buildAuthorizationsCol()
  return col.findOne({ id: authorizationId })
}

/**
 * Get build authorizations for a user.
 */
export async function listBuildAuthorizations(
  userId: string,
  limit = 20,
): Promise<BuildAuthorization[]> {
  const col = await buildAuthorizationsCol()
  return col
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}
