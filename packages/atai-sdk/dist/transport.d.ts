/**
 * Atai SDK — internal HTTP transport.
 *
 * The single place where SDK ↔ Runtime API communication is implemented:
 * URL construction, headers, authorization, JSON serialization/parsing,
 * status handling, request-ID propagation, timeout/cancellation, and
 * normalized errors. Capability methods never duplicate this logic.
 *
 * SECURITY INVARIANTS (verified by tests):
 *   - the ONLY network destination is the configured Atai Runtime origin,
 *   - `Authorization` is set exclusively from client configuration and can
 *     never be overridden by request parameters,
 *   - the API key never appears in any thrown error or log line.
 *
 * @module transport
 */
import { type ResolvedConfig } from "./config.js";
import type { AtaiRequestOptions, RuntimeEnvelopeResult } from "./types.js";
/** Default per-request timeout in milliseconds (0 disables the timeout). */
export declare const DEFAULT_TIMEOUT_MS = 60000;
interface ExecuteArgs<Body> {
    /** Path under the runtime API version path, e.g. "" or "/health". */
    path: string;
    method: "GET" | "POST";
    /** JSON-serializable request body (POST only). */
    body?: Body;
    /** Per-call options (signal only). */
    options?: AtaiRequestOptions;
}
/**
 * Perform one runtime API call and return the parsed runtime envelope.
 * Throws AtaiError for every failure mode (HTTP, transport, parse).
 */
export declare function execute<Body, T>(config: ResolvedConfig, args: ExecuteArgs<Body>): Promise<{
    envelope: Extract<RuntimeEnvelopeResult<T>, {
        ok: true;
    }>;
    requestId?: string;
}>;
/** Unused-variable guard for PROTECTED_HEADERS documentation value. */
export declare function isProtectedHeader(name: string): boolean;
export {};
//# sourceMappingURL=transport.d.ts.map