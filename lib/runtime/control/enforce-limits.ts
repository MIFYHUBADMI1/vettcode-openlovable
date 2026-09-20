import "server-only"
import { AppError } from "@/lib/errors"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { runtimeError } from "@/runtime/contracts/errors"
import type { RuntimeAuthContext } from "@/runtime/contracts/auth"
import {
  PLATFORM_RUNTIME_REQUESTS_PER_MINUTE,
  PLATFORM_RUNTIME_REQUESTS_PER_MINUTE_WINDOW_MS,
} from "@/lib/runtime/platform-limits"
import { getCachedProjectRuntimeConfig } from "./config-store"

function toRuntimeRateLimitError(e: unknown): unknown {
  if (e instanceof AppError && e.code === "RATE_LIMITED") {
    return runtimeError("runtime_rate_limited")
  }
  return e
}

/**
 * Optional project-level caps. Never raises the platform per-key 300/min ceiling.
 * Unset fields = no extra limiter (existing authenticate.ts cap still applies).
 */
export async function enforceProjectRuntimeLimits(
  auth: Pick<RuntimeAuthContext, "projectId" | "environment">,
): Promise<void> {
  const config = await getCachedProjectRuntimeConfig(auth.projectId)
  const rpm = config.limits.requestsPerMinute
  const rpd = config.limits.requestsPerDay

  if (rpm !== undefined) {
    const limit = Math.min(rpm, PLATFORM_RUNTIME_REQUESTS_PER_MINUTE)
    try {
      await checkRateLimit({
        action: "runtime_project_rpm",
        identifier: `${auth.projectId}:${auth.environment}`,
        limit,
        windowMs: PLATFORM_RUNTIME_REQUESTS_PER_MINUTE_WINDOW_MS,
        errorCode: "RATE_LIMITED",
      })
    } catch (e) {
      throw toRuntimeRateLimitError(e)
    }
  }

  if (rpd !== undefined) {
    try {
      await checkRateLimit({
        action: "runtime_project_rpd",
        identifier: `${auth.projectId}:${auth.environment}`,
        limit: rpd,
        windowMs: 24 * 60 * 60 * 1000,
        errorCode: "RATE_LIMITED",
      })
    } catch (e) {
      throw toRuntimeRateLimitError(e)
    }
  }
}
