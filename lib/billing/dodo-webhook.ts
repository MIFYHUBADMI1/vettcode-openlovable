import "server-only"
import { createHmac, timingSafeEqual } from "crypto"

/**
 * Dodo Payments webhook signature verification.
 *
 * Follows the Standard Webhooks spec:
 * - Signed message = `${webhook_id}.${webhook_timestamp}.${raw_body}`
 * - HMAC SHA-256 computed with the decoded webhook secret bytes
 *   (the whsec_ prefix is stripped, then the remainder is base64-decoded)
 * - Signature compared via constant-time comparison
 *
 * @see https://docs.dodopayments.com/developer-resources/webhooks#securing-webhooks
 */

/** Maximum age of a webhook in seconds (5 minutes). */
const MAX_WEBHOOK_AGE_SECONDS = 5 * 60

export interface WebhookVerificationResult {
  valid: boolean
  error?: string
}

/**
 * Verify the webhook signature from Dodo Payments.
 * Returns `{ valid: true }` on success, or `{ valid: false, error }` on failure.
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: {
    "webhook-id"?: string | null
    "webhook-signature"?: string | null
    "webhook-timestamp"?: string | null
  },
): WebhookVerificationResult {
  // Read the secret inside the function so it always picks up the current
  // process.env value (avoids module-load-time capture issues).
  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? ""

  const webhookId = headers["webhook-id"]
  const webhookSignature = headers["webhook-signature"]
  const webhookTimestamp = headers["webhook-timestamp"]

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    return {
      valid: false,
      error: "Missing required webhook headers (webhook-id, webhook-signature, webhook-timestamp)",
    }
  }

  if (!webhookSecret) {
    return { valid: false, error: "DODO_PAYMENTS_WEBHOOK_KEY not configured" }
  }

  // Validate timestamp to prevent replay attacks
  const timestamp = parseInt(webhookTimestamp, 10)
  if (isNaN(timestamp)) {
    return { valid: false, error: "Invalid webhook timestamp" }
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const ageSeconds = Math.abs(nowSeconds - timestamp)
  if (ageSeconds > MAX_WEBHOOK_AGE_SECONDS) {
    return {
      valid: false,
      error: `Webhook timestamp too old (${ageSeconds}s, max ${MAX_WEBHOOK_AGE_SECONDS}s)`,
    }
  }

  // Strip the whsec_ prefix, then base64-decode the remainder into raw bytes.
  // The HMAC key must be the decoded bytes — NOT the raw base64 string.
  const b64Secret = webhookSecret.startsWith("whsec_")
    ? webhookSecret.slice("whsec_".length)
    : webhookSecret

  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(b64Secret, "base64")
  } catch {
    return { valid: false, error: "Invalid webhook secret format (failed base64 decode)" }
  }

  // Build the signed message: id.timestamp.body
  const signedMessage = `${webhookId}.${webhookTimestamp}.${rawBody}`

  // Compute HMAC SHA-256 using the decoded secret bytes
  const expectedSignatureBytes = createHmac("sha256", secretBytes)
    .update(signedMessage, "utf8")
    .digest()

  // The signature header may contain multiple signatures (space-separated)
  // to support secret rotation. Accept if any match.
  const signatures = webhookSignature.split(" ")
  let matched = false

  for (const sig of signatures) {
    // Signatures may be prefixed with "v1,"
    const b64Sig = sig.startsWith("v1,") ? sig.slice(3) : sig

    let sigBytes: Buffer
    try {
      sigBytes = Buffer.from(b64Sig, "base64")
    } catch {
      continue // skip malformed entries
    }

    if (
      sigBytes.length === expectedSignatureBytes.length &&
      timingSafeEqual(sigBytes, expectedSignatureBytes)
    ) {
      matched = true
      break
    }
  }

  if (!matched) {
    return { valid: false, error: "Signature verification failed" }
  }

  return { valid: true }
}
