import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { ObjectId } from "mongodb"
import { webhookEventsCol } from "@/lib/db/collections"
import { verifyWebhookSignature } from "@/lib/billing/dodo-webhook"
import { logger } from "@/lib/logging/logger"
import { cryptoId } from "@/lib/store/id"
import { processDodoEvent } from "@/lib/billing/dodo-event-processing"
import type { WebhookEventDoc } from "@/lib/types/db"

export const runtime = "nodejs"

// This route must hash the raw bytes for HMAC verification, so it can't use
// readJsonBody. Dodo event payloads are a few KB; anything past 1 MB is abuse
// and is rejected before it gets buffered.
const MAX_WEBHOOK_BYTES = 1_000_000

/**
 * Dodo webhook ingestion (Phase 3 restructure):
 *
 *  This route owns INGESTION ONLY — signature verification, durable event
 *  persistence (unique webhookId dedupe), and outcome bookkeeping. All
 *  business logic lives in the shared module
 *  `lib/billing/dodo-event-processing.ts`, which the recovery worker
 *  (`lib/billing/webhook-recovery.ts`) re-invokes for failed/unresolved
 *  events — so live and recovered processing can never diverge.
 *
 *  HTTP 200 here means "received and durably recorded" — NOT "all financial
 *  effects completed". Processing failures mark the event `failed` (with an
 *  idempotent replay path) instead of failing the delivery, matching the
 *  Phase 1 invariant that every discrepancy stays discoverable.
 */

export async function GET() {
  // Configuration health only. Phase 3 security fix: the previous response
  // exposed the first characters of the webhook signing key — a credential
  // prefix is a credential fragment and is never surfaced. Booleans only.
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? ""
  const apiKey = process.env.DODO_PAYMENTS_API_KEY ?? ""
  return NextResponse.json({
    ok: true,
    data: {
      endpoint: "/api/billing/webhook",
      webhookKeyConfigured: webhookKey.length > 0,
      apiKeyConfigured: apiKey.length > 0,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? "(missing)",
      timestamp: new Date().toISOString(),
    },
  })
}

export async function POST(req: Request) {
  let webhookId = ""
  let rawBody = ""

  try {
    const declaredLength = Number(req.headers.get("content-length") ?? "0")
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
      return NextResponse.json(
        { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" } },
        { status: 413 },
      )
    }

    rawBody = await req.text()
    if (rawBody.length > MAX_WEBHOOK_BYTES) {
      return NextResponse.json(
        { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" } },
        { status: 413 },
      )
    }
    webhookId = req.headers.get("webhook-id") ?? ""

    logger.info("webhook.dodo", "Received webhook", {
      webhookId,
      hasSignature: Boolean(req.headers.get("webhook-signature")),
      hasTimestamp: Boolean(req.headers.get("webhook-timestamp")),
      bodyLength: rawBody.length,
      webhookKeyConfigured: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY),
    })

    const verification = verifyWebhookSignature(rawBody, {
      "webhook-id": req.headers.get("webhook-id"),
      "webhook-signature": req.headers.get("webhook-signature"),
      "webhook-timestamp": req.headers.get("webhook-timestamp"),
    })

    if (!verification.valid) {
      logger.warn("webhook.dodo", "Invalid webhook signature", {
        webhookId,
        error: verification.error,
        webhookKeyConfigured: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY),
      })
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" } },
        { status: 401 },
      )
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      logger.warn("webhook.dodo", "Invalid JSON payload", { webhookId })
      return NextResponse.json({ ok: true, data: { received: true } })
    }

    const eventType = payload.type as string
    const eventData = payload.data as Record<string, unknown> | undefined

    if (!eventType) {
      logger.warn("webhook.dodo", "Missing event type", { webhookId })
      return NextResponse.json({ ok: true, data: { received: true } })
    }

    // Persist event for webhook-id-level idempotency (Dodo may retry same event)
    const col = await webhookEventsCol()
    const payloadHash = createHash("sha256").update(rawBody).digest("hex")
    const now = Date.now()

    const existing = await col.findOne({ webhookId })
    if (existing) {
      logger.info("webhook.dodo", "Duplicate webhook-id ignored", { webhookId, eventType })
      return NextResponse.json({ ok: true, data: { received: true, duplicate: true } })
    }

    const eventDoc: WebhookEventDoc = {
      _id: new ObjectId(),
      id: `evt_${cryptoId()}`,
      provider: "dodo",
      webhookId,
      eventType,
      payload,
      payloadHash,
      status: "received",
      receivedAt: now,
      // Live delivery is the first attempt (Phase 3 recovery bookkeeping).
      attempts: 1,
      lastAttemptAt: now,
    }

    try {
      await col.insertOne(eventDoc)
    } catch (err) {
      if (err instanceof Error && /E11000|duplicate key/i.test(err.message)) {
        logger.info("webhook.dodo", "Duplicate webhook (race condition)", { webhookId, eventType })
        return NextResponse.json({ ok: true, data: { received: true, duplicate: true } })
      }
      throw err
    }

    try {
      const outcome = await processDodoEvent(eventType, eventData, eventDoc.id)
      if (outcome.status === "unresolved") {
        // A verified event that could not be safely attributed (no trusted
        // user/payment association, refund-before-payment, currency mismatch).
        // Preserved with an explicit status so it stays discoverable — never
        // silently "processed", never granted on a guess. The recovery worker
        // may resolve it later once the missing authoritative record lands.
        await col.updateOne(
          { id: eventDoc.id },
          { $set: { status: "unresolved", error: outcome.reason, processedAt: Date.now() } },
        )
      } else {
        await col.updateOne(
          { id: eventDoc.id },
          { $set: { status: "processed", processedAt: Date.now() } },
        )
      }
    } catch (processingError) {
      // Required financial write failed: the event is durably marked `failed`
      // with backoff bookkeeping so the recovery workflow can re-run the same
      // idempotent processing later. The delivery itself still acks (Dodo
      // would retry anyway; our own queue is the source of truth).
      await col
        .updateOne(
          { id: eventDoc.id },
          {
            $set: {
              status: "failed",
              error: processingError instanceof Error ? processingError.message : String(processingError),
              processedAt: Date.now(),
              nextAttemptAt: Date.now() + 60_000,
            },
          },
        )
        .catch(() => {})
      logger.error("webhook.dodo", "Event processing failed", {
        webhookId,
        eventType,
        eventId: eventDoc.id,
        error: processingError instanceof Error ? processingError.message : String(processingError),
      })
    }

    return NextResponse.json({ ok: true, data: { received: true } })
  } catch (error) {
    logger.error("webhook.dodo", "Unexpected webhook error", {
      webhookId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ ok: true, data: { received: true } })
  }
}
