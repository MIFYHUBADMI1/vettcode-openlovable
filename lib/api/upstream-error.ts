/** Classify driver/SDK failures so routes can fail fast with a useful message. */

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function isTlsClockError(error: unknown): boolean {
  const message = errorMessageOf(error)
  return /certificate is not yet valid|certificate has expired|CERT_NOT_YET_VALID|CERT_HAS_EXPIRED|ERR_TLS_CERT/i.test(
    message,
  )
}

export function isDatabaseConnectivityError(error: unknown): boolean {
  const message = errorMessageOf(error)
  // Driver errors identify themselves by NAME, not always by message — a
  // pool checkout timeout says only "Timed out while checking out a connection
  // from connection pool", so matching the message alone turned a transient DB
  // problem into a generic 500.
  const name = error instanceof Error ? error.name : ""
  if (/^Mongo(Network|ServerSelection|WaitQueueTimeout|PoolCleared|Topology|NotConnected|Timeout)/.test(name)) {
    return true
  }
  return /mongo|mongodb|topology|server selection|connection pool|checking out a connection|connection <monitor>/i.test(
    message,
  )
}

export function isAbortTimeoutError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return true
  }
  const message = errorMessageOf(error)
  return /aborted due to timeout|The operation was aborted|TimeoutError/i.test(message)
}

export function tlsClockUserMessage(): string {
  return "Atai couldn't reach the AI service because this computer's clock looks wrong (the security certificate isn't valid yet). Check Windows date and time is automatic and correct, then try again."
}

const UNREACHABLE_CAUSE_CODES = [
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EPIPE",
]

/**
 * True when the call never reached the AI provider (or the provider could not
 * reach its own upstream) — a transport failure, not a bad request.
 *
 * The AI SDK wraps undici connect failures as `APICallError` with the message
 * "Cannot connect to API: …" and keeps the driver code on `cause`. Those used to
 * fall through to a generic 500 "Something went wrong", which told the founder
 * nothing while the real cause was a few seconds of lost connectivity.
 */
export function isProviderUnreachableError(error: unknown): boolean {
  if (isTlsClockError(error) || isDatabaseConnectivityError(error)) return false
  let node: unknown = error
  for (let depth = 0; node != null && depth < 6; depth++, node = (node as { cause?: unknown }).cause) {
    const message = errorMessageOf(node)
    if (/cannot connect to api|fetch failed|socket hang up|provider returned error|temporarily rate-limited/i.test(message)) {
      return true
    }
    const code = (node as { code?: unknown }).code
    if (typeof code === "string" && UNREACHABLE_CAUSE_CODES.includes(code)) return true
  }
  return false
}

export function providerUnreachableUserMessage(): string {
  return "The AI service couldn't be reached just now — the connection failed or its model provider was unavailable. Nothing was changed by this attempt, so it is safe to try again in a few seconds."
}

/**
 * Flatten an error and its `cause` chain into log lines.
 *
 * The AI SDK hides the real reason inside `cause`: a rejected-but-successful
 * response logs only "Failed to process successful response", and a connect
 * failure only "Cannot connect to API". Without the chain, the log can't tell
 * a bad provider payload apart from a dead socket.
 */
export function describeErrorChain(error: unknown, maxDepth = 6): string[] {
  const lines: string[] = []
  let node: unknown = error
  for (let depth = 0; node != null && depth < maxDepth; depth++) {
    const e = node as { name?: string; message?: string; code?: unknown; statusCode?: unknown; issues?: unknown }
    const name = e.name ?? (node instanceof Error ? "Error" : typeof node)
    const message = typeof e.message === "string" ? e.message : String(node)
    const code = typeof e.code === "string" ? ` code=${e.code}` : ""
    const status = typeof e.statusCode === "number" ? ` status=${e.statusCode}` : ""
    lines.push(`${name}: ${message}${code}${status}`.slice(0, 400))
    // Schema validators name the offending path, which is the part worth keeping.
    if (Array.isArray(e.issues) && e.issues.length) {
      const paths = (e.issues as Array<{ path?: unknown; message?: string }>)
        .slice(0, 4)
        .map((i) => `${(Array.isArray(i.path) ? i.path : []).map(String).join(".") || "?"}: ${i.message ?? ""}`)
      lines.push(`  offending: ${paths.join(" | ")}`.slice(0, 400))
    }
    node = (node as { cause?: unknown }).cause
  }
  return lines
}

export function aiTimeoutUserMessage(): string {
  return "The co-founder took too long to reply. Try a shorter message, or send it again."
}
