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
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, AtaiHealthResult } from "../types.js";
export type { AtaiHealthResult } from "../types.js";
/** The Atai health capability. Exposed as `atai.health` on the client. */
export declare class HealthCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /**
     * Verify runtime connectivity and credential status
     * (`GET /api/runtime/v1/health`, Bearer-authenticated).
     */
    check(options?: AtaiRequestOptions): Promise<AtaiHealthResult>;
}
//# sourceMappingURL=health.d.ts.map