import "server-only"
import { ObjectId } from "mongodb"
import { topupsCol, usersCol } from "@/lib/db/collections"
import { getPackageById } from "./packages"
import { grantCredits } from "./credit-service"

/** @deprecated Legacy reference expiry — 24 hours. */
const REFERENCE_EXPIRY_MS = 24 * 60 * 60 * 1000
import { generatePaymentReference, normalizePhone, hashBuffer } from "./payment-ref"
import { cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import type { TopUpDoc, TopUpStatus } from "@/lib/types/db"
import type { PaymentNetwork } from "./types"

// ─── Create Top-Up ──────────────────────────────────────────────────────────

export interface CreateTopUpParams {
  userId: string
  packageId: string
  paymentNetwork: PaymentNetwork
  payerPhone: string
}

export interface CreateTopUpResult {
  topUp: {
    id: string
    packageId: string
    credits: number
    expectedAmount: number
    paymentReference: string
    payerPhone: string
    paymentNetwork: PaymentNetwork
    status: TopUpStatus
    createdAt: number
    expiresAt: number
  }
}

export async function createTopUp(params: CreateTopUpParams): Promise<CreateTopUpResult> {
  const pkg = getPackageById(params.packageId)
  if (!pkg) throw new Error("Invalid package")

  const paymentReference = await generatePaymentReference()
  const now = Date.now()
  const id = `topup_${cryptoId()}`
  const normalizedPhone = normalizePhone(params.payerPhone)

  const doc: TopUpDoc = {
    _id: new ObjectId(),
    id,
    userId: params.userId,
    packageId: params.packageId,
    credits: pkg.credits,
    expectedAmount: pkg.priceUSD,
    paymentReference,
    payerPhone: normalizedPhone,
    paymentNetwork: params.paymentNetwork,
    status: "awaiting_payment",
    evidenceFileIds: [],
    evidenceHashes: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + REFERENCE_EXPIRY_MS,
  }

  const col = await topupsCol()
  await col.insertOne(doc)

  logger.info("topup.create", "top-up created", {
    userId: params.userId,
    topUpId: id,
    packageId: params.packageId,
    credits: pkg.credits,
    network: params.paymentNetwork,
  })

  return {
    topUp: {
      id,
      packageId: params.packageId,
      credits: pkg.credits,
      expectedAmount: pkg.priceUSD,
      paymentReference,
      payerPhone: normalizedPhone,
      paymentNetwork: params.paymentNetwork,
      status: "awaiting_payment",
      createdAt: now,
      expiresAt: now + REFERENCE_EXPIRY_MS,
    },
  }
}

// ─── Upload Evidence ─────────────────────────────────────────────────────────

export interface UploadEvidenceParams {
  topUpId: string
  userId: string
  fileBuffer: Buffer
  fileName: string
  mimeType: string
}

export async function uploadEvidence(params: UploadEvidenceParams): Promise<{ fileId: string }> {
  const col = await topupsCol()
  const topUp = await col.findOne({ id: params.topUpId, userId: params.userId })

  if (!topUp) throw new Error("Top-up not found")
  if (topUp.status === "cancelled" || topUp.status === "expired") {
    throw new Error("This top-up is no longer active")
  }

  // Hash the evidence for duplicate detection
  const hash = await hashBuffer(params.fileBuffer)

  // Check for duplicate evidence
  if (topUp.evidenceHashes.includes(hash)) {
    throw new Error("This screenshot has already been uploaded")
  }

  // Upload to ImageKit
  const { uploadImageToImageKit } = await import("@/lib/imagekit/upload")
  const result = await uploadImageToImageKit({
    file: params.fileBuffer,
    fileName: params.fileName,
    mimeType: params.mimeType,
    folder: "/mirrorsite/evidence",
  })

  await col.updateOne(
    { id: params.topUpId },
    {
      $push: {
        evidenceFileIds: result.fileId,
        evidenceHashes: hash,
      },
      $set: { status: "payment_submitted", updatedAt: Date.now() },
    },
  )

  logger.info("topup.evidence", "evidence uploaded", {
    userId: params.userId,
    topUpId: params.topUpId,
    fileId: result.fileId,
  })

  return { fileId: result.fileId }
}

// ─── Credit Award ────────────────────────────────────────────────────────────

/**
 * Atomically award credits for an approved top-up.
 * Uses credit-service to ensure proper ledger recording.
 */
export async function awardCredits(topUpId: string, verifiedBy: string): Promise<boolean> {
  const col = await topupsCol()
  const topUp = await col.findOne({ id: topUpId })

  if (!topUp) {
    logger.error("topup.award", "top-up not found", { topUpId })
    return false
  }

  if (topUp.status !== "payment_submitted" && topUp.status !== "manual_review" && topUp.status !== "analyzing") {
    logger.warn("topup.award", "top-up not in awardable state", { topUpId, status: topUp.status })
    return false
  }

  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()

  try {
    let success = false
    await session.withTransaction(async () => {
      // Update top-up status to approved
      const result = await col.updateOne(
        { id: topUpId, status: { $nin: ["approved", "rejected", "cancelled", "expired"] } },
        {
          $set: {
            status: "approved",
            verifiedAt: Date.now(),
            verifiedBy,
            updatedAt: Date.now(),
          },
        },
        { session },
      )

      if (result.modifiedCount === 0) {
        success = false
        return
      }

      success = true
    })

    if (success) {
      // Grant credits via credit-service (outside the transaction to avoid nested transactions)
      await grantCredits({
        userId: topUp.userId,
        creditType: "permanent",
        amount: topUp.credits,
        transactionType: "credit_purchase",
        idempotencyKey: `topup_grant_${topUpId}`,
        referenceType: "topup",
        referenceId: topUpId,
        metadata: {
          reason: `Credit purchase (${topUp.credits.toLocaleString()} credits)`,
          packageId: topUp.packageId,
          verifiedBy,
        },
      })

      logger.info("topup.award", "credits awarded", {
        topUpId,
        userId: topUp.userId,
        credits: topUp.credits,
        verifiedBy,
      })
    }

    return success
  } finally {
    await session.endSession()
  }
}

// ─── Reject Top-Up ───────────────────────────────────────────────────────────

export async function rejectTopUp(topUpId: string, reason: string, verifiedBy: string): Promise<boolean> {
  const col = await topupsCol()
  const result = await col.updateOne(
    { id: topUpId, status: { $nin: ["approved", "rejected", "cancelled", "expired"] } },
    {
      $set: {
        status: "rejected",
        rejectionReason: reason,
        verifiedAt: Date.now(),
        verifiedBy,
        updatedAt: Date.now(),
      },
    },
  )

  if (result.modifiedCount > 0) {
    logger.info("topup.reject", "top-up rejected", { topUpId, reason, verifiedBy })
    return true
  }
  return false
}

// ─── Get Top-Up ──────────────────────────────────────────────────────────────

export async function getTopUp(topUpId: string, userId?: string): Promise<TopUpDoc | null> {
  const col = await topupsCol()
  if (userId && userId !== "any") {
    return col.findOne({ id: topUpId, userId })
  }
  return col.findOne({ id: topUpId })
}

export async function getTopUpByRef(paymentReference: string): Promise<TopUpDoc | null> {
  const col = await topupsCol()
  return col.findOne({ paymentReference })
}

// ─── List User Top-Ups ──────────────────────────────────────────────────────

export async function listUserTopUps(userId: string, limit = 20): Promise<TopUpDoc[]> {
  const col = await topupsCol()
  return col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray()
}

// ─── Admin: List Pending Top-Ups ─────────────────────────────────────────────

export async function listPendingTopUps(limit = 50): Promise<TopUpDoc[]> {
  const col = await topupsCol()
  return col
    .find({ status: { $in: ["payment_submitted", "analyzing", "manual_review"] } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}
