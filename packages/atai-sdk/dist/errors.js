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
export class AtaiError extends Error {
    /** Normalized error code (`runtime_*` from Atai, `atai_*` from the SDK). */
    code;
    /** HTTP status, when the failure came from an HTTP response. */
    status;
    /** Server-provided request ID for support/debugging correlation. */
    requestId;
    /** Safe retry metadata when the runtime provides it. */
    retry;
    constructor(code, message, options = {}) {
        // Never include the API key or any credential in `message`.
        super(message);
        this.name = "AtaiError";
        this.code = code;
        if (options.status !== undefined)
            this.status = options.status;
        if (options.requestId !== undefined)
            this.requestId = options.requestId;
        if (options.retry !== undefined)
            this.retry = options.retry;
        // Keep the original cause for debugging without widening the public shape.
        if (options.cause !== undefined) {
            Object.defineProperty(this, "cause", { value: options.cause, enumerable: false, writable: true, configurable: true });
        }
    }
    /**
     * Safe serialization: only public, non-sensitive fields. Note the API key
     * is not a field of this class at all, so no serialization path can leak it.
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            ...(this.status !== undefined ? { status: this.status } : {}),
            ...(this.requestId !== undefined ? { requestId: this.requestId } : {}),
            ...(this.retry !== undefined ? { retry: this.retry } : {}),
        };
    }
}
/** True when the error is an SDK authentication failure (HTTP 401 family). */
export function isAuthenticationError(e) {
    return e instanceof AtaiError && e.status === 401;
}
/** True when the error is an SDK authorization failure (HTTP 403 family). */
export function isAuthorizationError(e) {
    return e instanceof AtaiError && e.status === 403;
}
/** True when the error is rate-limited (HTTP 429). */
export function isRateLimitError(e) {
    return e instanceof AtaiError && e.status === 429;
}
//# sourceMappingURL=errors.js.map