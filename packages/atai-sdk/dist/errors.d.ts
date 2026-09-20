/**
 * Atai SDK — normalized error type.
 *
 * `AtaiError` is the single error surface of the SDK. It wraps the Runtime
 * API's normalized error taxonomy (`runtime_*` codes) plus transport-level
 * SDK failures (`atai_*` codes). The class carries only safe data: HTTP
 * status, normalized code, message, and the server-provided request ID for
 * support/debugging correlation.
 *
 * SECURITY INVARIANTS (verified by tests):
 *   - the configured API key never appears in the message or any field,
 *   - serializing the error (String / JSON.stringify) can never leak the
 *     key, because the key is never stored on the error,
 *   - raw server/provider internals are never included beyond the envelope
 *     the Runtime API itself exposes (which is already safe by contract).
 *
 * @module errors
 */
/**
 * SDK-local failure codes (transport/configuration problems detected
 * client-side). Runtime-originated failures keep their canonical
 * `runtime_*` codes unchanged — the SDK does not invent a second taxonomy.
 */
export type AtaiSdkErrorCode = "atai_missing_api_key" | "atai_invalid_api_key" | "atai_invalid_config" | "atai_invalid_request" | "atai_network_error" | "atai_timeout" | "atai_aborted" | "atai_invalid_response";
/** All error codes an AtaiError can carry. */
export type AtaiErrorCode = AtaiSdkErrorCode | (string & {});
/** Optional safe retry metadata (e.g. from a 429 response). */
export interface AtaiErrorRetry {
    /** Server-advised delay before retrying, in milliseconds. */
    afterMs?: number;
}
export declare class AtaiError extends Error {
    /** Normalized error code (`runtime_*` from Atai, `atai_*` from the SDK). */
    readonly code: AtaiErrorCode;
    /** HTTP status, when the failure came from an HTTP response. */
    readonly status?: number;
    /** Server-provided request ID for support/debugging correlation. */
    readonly requestId?: string;
    /** Safe retry metadata when the runtime provides it. */
    readonly retry?: AtaiErrorRetry;
    constructor(code: AtaiErrorCode, message: string, options?: {
        status?: number;
        requestId?: string;
        retry?: AtaiErrorRetry;
        cause?: unknown;
    });
    /**
     * Safe serialization: only public, non-sensitive fields. Note the API key
     * is not a field of this class at all, so no serialization path can leak it.
     */
    toJSON(): {
        name: string;
        code: AtaiErrorCode;
        message: string;
        status?: number;
        requestId?: string;
        retry?: AtaiErrorRetry;
    };
}
/** True when the error is an SDK authentication failure (HTTP 401 family). */
export declare function isAuthenticationError(e: unknown): e is AtaiError;
/** True when the error is an SDK authorization failure (HTTP 403 family). */
export declare function isAuthorizationError(e: unknown): e is AtaiError;
/** True when the error is rate-limited (HTTP 429). */
export declare function isRateLimitError(e: unknown): e is AtaiError;
//# sourceMappingURL=errors.d.ts.map