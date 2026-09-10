import { topupsCol } from "@/lib/db/collections"

/**
 * Generate a unique 6-digit numeric payment reference for a top-up.
 * Checks for collisions against active (non-expired, non-cancelled) top-ups.
 * Server-side only — never exposed to the client until created.
 */
export async function generatePaymentReference(): Promise<string> {
  const col = await topupsCol()
  const maxAttempts = 20

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate a 6-digit number (100000–999999)
    const ref = String(100000 + Math.floor(Math.random() * 900000))

    // Check if this reference is already used by an active top-up
    const existing = await col.findOne({
      paymentReference: ref,
      status: { $nin: ["cancelled", "expired", "rejected"] },
    })

    if (!existing) {
      return ref
    }
  }

  throw new Error("Failed to generate a unique payment reference after multiple attempts")
}

/**
 * Normalize a Ugandan phone number to a canonical format.
 * Accepts: +256761234567, 0761234567, 256761234567
 * Returns: +256761234567
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("256") && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+256${digits.slice(1)}`
  }
  return `+${digits}`
}

/**
 * Calculate SHA-256 hash of a buffer for duplicate evidence detection.
 */
export async function hashBuffer(buffer: Buffer): Promise<string> {
  const { createHash } = await import("crypto")
  return createHash("sha256").update(buffer).digest("hex")
}
