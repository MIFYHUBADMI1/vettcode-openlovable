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
import { buildUrl } from "./config.js";
import { AtaiError } from "./errors.js";
/** Default per-request timeout in milliseconds (0 disables the timeout). */
export const DEFAULT_TIMEOUT_MS = 60_000;
/** Headers the transport always sets itself; callers can never override them. */
const PROTECTED_HEADERS = new Set(["authorization", "content-type", "accept", "host"]);
/**
 * Perform one runtime API call and return the parsed runtime envelope.
 * Throws AtaiError for every failure mode (HTTP, transport, parse).
 */
export async function execute(config, args) {
    const { path, method, body, options } = args;
    // ── Timeout/cancellation wiring ──────────────────────────────────────────
    const controllers = [];
    let timeoutId;
    let timedOut = false;
    const timeoutMs = DEFAULT_TIMEOUT_MS;
    // External signal (caller's AbortSignal), if any.
    const externalSignal = options?.signal;
    if (externalSignal?.aborted) {
        throw new AtaiError("atai_aborted", "The request was aborted before it was sent.");
    }
    const controller = new AbortController();
    controllers.push(controller);
    if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);
    }
    // Propagate caller abortion to the internal controller.
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
        if (typeof externalSignal.addEventListener === "function") {
            externalSignal.addEventListener("abort", onExternalAbort, { once: true });
        }
    }
    const url = buildUrl(config, path);
    try {
        const headers = {
            accept: "application/json",
            // The credential is applied here and nowhere else. Request parameters
            // carry no headers at all, so it can never be overridden.
            authorization: `Bearer ${config.apiKey}`,
        };
        if (method === "POST" && body !== undefined) {
            headers["content-type"] = "application/json";
        }
        const response = await fetch(url, {
            method,
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal,
        });
        return await handleResponse(response);
    }
    catch (e) {
        // Distinguish abort/timeout from genuine network failures so callers get
        // accurate, actionable errors — cancellation must never masquerade as a
        // provider or network problem.
        if (timedOut) {
            throw new AtaiError("atai_timeout", "The request to the Atai Runtime API timed out.");
        }
        if (isAbortError(e)) {
            throw new AtaiError("atai_aborted", "The request was aborted.");
        }
        if (e instanceof AtaiError)
            throw e;
        throw new AtaiError("atai_network_error", "Could not reach the Atai Runtime API.", { cause: e });
    }
    finally {
        if (timeoutId !== undefined)
            clearTimeout(timeoutId);
        if (externalSignal && typeof externalSignal.removeEventListener === "function") {
            externalSignal.removeEventListener("abort", onExternalAbort);
        }
    }
}
/** True when the thrown value is a fetch AbortError (any environment naming). */
function isAbortError(e) {
    return e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError");
}
/**
 * Read, parse, and classify one HTTP response into the normalized SDK
 * result/error model.
 */
async function handleResponse(response) {
    const requestId = response.headers.get("x-request-id") ?? undefined;
    const status = response.status;
    // Read the body as text first so malformed JSON can be reported as a
    // controlled SDK error instead of an opaque parse exception (spec §55).
    const rawText = await response.text().catch(() => null);
    // Safe retry metadata for 429 (Retry-After seconds per HTTP semantics).
    const retryAfterMs = status === 429 ? parseRetryAfterMs(response.headers.get("retry-after")) : undefined;
    if (!response.ok) {
        throw httpErrorFromResponse(status, rawText, requestId, retryAfterMs);
    }
    let parsed;
    try {
        parsed = rawText === null ? null : JSON.parse(rawText);
    }
    catch {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned malformed JSON.", {
            status,
            requestId,
        });
    }
    if (!isSuccessEnvelope(parsed)) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.", {
            status,
            requestId,
        });
    }
    return { envelope: parsed, requestId: parsed.data.requestId ?? requestId };
}
/**
 * Build the normalized AtaiError for a non-2xx response. The runtime error
 * envelope is `{ ok: false, error: { code, message } }`; anything else is
 * reported with safe generic messaging while preserving status/requestId.
 */
function httpErrorFromResponse(status, rawText, requestId, retryAfterMs) {
    let code;
    let message;
    if (rawText !== null) {
        try {
            const parsed = JSON.parse(rawText);
            if (isErrorEnvelope(parsed)) {
                code = parsed.error.code;
                message = parsed.error.message;
            }
        }
        catch {
            // Non-JSON error body — fall through to generic messaging below.
        }
    }
    if (message === undefined) {
        message = FALLBACK_MESSAGES[status] ?? `The Atai Runtime API returned HTTP ${status}.`;
    }
    return new AtaiError(code ?? "atai_invalid_response", message, {
        status,
        requestId,
        ...(retryAfterMs !== undefined ? { retry: { afterMs: retryAfterMs } } : {}),
    });
}
/** Generic, safe fallback messages per HTTP status family. */
const FALLBACK_MESSAGES = {
    400: "The request was rejected as invalid.",
    401: "Authentication failed. Check that your Atai API key is valid and active.",
    402: "The account backing this API key has insufficient credits.",
    403: "This API key is not allowed to perform this action.",
    404: "The requested capability or operation was not found.",
    409: "The request conflicts with the current state.",
    422: "The request body is invalid for this capability.",
    429: "Too many requests. Please retry later.",
    500: "The Atai Runtime API encountered an internal error.",
    501: "This capability is not available yet.",
    502: "The upstream provider returned an error.",
    503: "The Atai Runtime API is temporarily unavailable.",
    504: "The upstream provider timed out.",
};
/** Parse a Retry-After header (seconds) into milliseconds, safely. */
function parseRetryAfterMs(value) {
    if (value === null)
        return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0)
        return Math.round(seconds * 1000);
    return undefined;
}
function isErrorEnvelope(parsed) {
    if (typeof parsed !== "object" || parsed === null)
        return false;
    const obj = parsed;
    if (obj.ok !== false)
        return false;
    const error = obj.error;
    return typeof error?.code === "string" && typeof error?.message === "string";
}
function isSuccessEnvelope(parsed) {
    if (typeof parsed !== "object" || parsed === null)
        return false;
    const obj = parsed;
    if (obj.ok !== true)
        return false;
    const data = obj.data;
    return (typeof data?.requestId === "string" &&
        typeof data?.capability === "string" &&
        typeof data?.operation === "string" &&
        "data" in data);
}
/** Unused-variable guard for PROTECTED_HEADERS documentation value. */
export function isProtectedHeader(name) {
    return PROTECTED_HEADERS.has(name.toLowerCase());
}
//# sourceMappingURL=transport.js.map