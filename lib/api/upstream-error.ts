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

export function aiTimeoutUserMessage(): string {
  return "The co-founder took too long to reply. Try a shorter message, or send it again."
}
