/**
 * Atai SDK — Health capability.
 *
 * A lightweight connectivity/status probe for generated applications:
 * `await atai.health.check()` verifies that the configured Atai runtime key
 * authenticates and the Runtime API is reachable — the "Atai Runtime
 * connected" signal — WITHOUT exposing the key or any provider internals.
 *
 * The health endpoint shares the invocation route's authentication path, so
 * a successful check proves the credential is active and the runtime context
 * resolves. It is a GET against `/api/runtime/v1/health` (no body).
 *
 * @module capabilities/health
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type { AtaiRequestOptions, AtaiHealthResult } from "../types.js"

export type { AtaiHealthResult } from "../types.js"

/** The Atai health capability. Exposed as `atai.health` on the client. */
export class HealthCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /**
   * Verify runtime connectivity and credential status
   * (`GET /api/runtime/v1/health`, Bearer-authenticated).
   */
  async check(options?: AtaiRequestOptions): Promise<AtaiHealthResult> {
    const { envelope } = await execute<undefined, AtaiHealthResult>(this.config, {
      path: "/health",
      method: "GET",
      options,
    })

    return assertHealthResult(envelope.data.data)
  }
}

/** Narrow runtime check on the returned payload (never trust the server blindly). */
function assertHealthResult(payload: unknown): AtaiHealthResult {
  if (typeof payload !== "object" || payload === null) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  const p = payload as Record<string, unknown>
  const identity = p.identity as Record<string, unknown> | undefined
  const valid =
    typeof p.status === "string" &&
    typeof p.requestId === "string" &&
    typeof identity?.projectId === "string" &&
    typeof identity?.environment === "string" &&
    typeof identity?.apiKeyId === "string" &&
    Array.isArray(identity?.scopes)
  if (!valid) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as AtaiHealthResult
}
