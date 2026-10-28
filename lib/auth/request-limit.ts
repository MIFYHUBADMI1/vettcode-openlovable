import { createHash } from "node:crypto"
import { clientIpBucket } from "@/lib/api/client-ip"
import { checkRateLimit } from "@/lib/auth/rate-limit"

const limits = {
  login: { limit: 60, windowMs: 15 * 60_000 },
  register: { limit: 10, windowMs: 60 * 60_000 },
  password_reset_request: { limit: 15, windowMs: 60 * 60_000 },
  password_reset_submit: { limit: 20, windowMs: 15 * 60_000 },
  verify_email: { limit: 60, windowMs: 15 * 60_000 },
  confirm_email_change: { limit: 30, windowMs: 15 * 60_000 },
  change_password: { limit: 20, windowMs: 60 * 60_000 },
  change_email: { limit: 10, windowMs: 60 * 60_000 },
  resend_verification: { limit: 15, windowMs: 60 * 60_000 },
} as const

export async function checkAuthRequest(request: Request, action: keyof typeof limits): Promise<void> {
  const identity = clientIpBucket(request)
  // A fixed shared bucket bounds new identifier rows even across distributed callers.
  await checkRateLimit({ action: "auth_ingress", identifier: "shared", limit: 1000, windowMs: 60_000 })
  await checkRateLimit({
    action: `${action}_ip`,
    identifier: createHash("sha256").update(identity).digest("hex"),
    ...limits[action],
  })
}
