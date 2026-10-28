import { createHash } from "node:crypto"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { AppError } from "@/lib/errors"

export async function checkInternalLimit(headers: Headers): Promise<void> {
  const key = headers.get("x-internal-key")
  if (!key) throw new AppError("UNAUTHORIZED")
  await checkRateLimit({ action: "internal_api", identifier: createHash("sha256").update(key).digest("hex"), limit: 120, windowMs: 60_000 })
}
