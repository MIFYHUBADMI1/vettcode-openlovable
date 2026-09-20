/**
 * In-process cap on concurrent authenticated runtime work.
 *
 * Per-key Mongo rate limits do not protect a single Node process: many keys
 * can still pile up provider sockets and 8 MB response buffers. This limiter
 * is fail-fast (429), not a wait queue — waiting would hold memory too.
 *
 * Scope is this process only. Multiple instances each have their own cap.
 */

const DEFAULT_MAX_IN_FLIGHT = 32
const MIN_MAX_IN_FLIGHT = 4
const MAX_MAX_IN_FLIGHT = 256

let inFlight = 0
let maxOverride: number | undefined

export function getRuntimeMaxInFlight(): number {
  if (maxOverride !== undefined) return maxOverride
  const raw = Number(process.env.RUNTIME_MAX_IN_FLIGHT)
  if (Number.isFinite(raw) && raw >= MIN_MAX_IN_FLIGHT && raw <= MAX_MAX_IN_FLIGHT) {
    return Math.floor(raw)
  }
  return DEFAULT_MAX_IN_FLIGHT
}

export function runtimeInFlight(): number {
  return inFlight
}

export function tryAcquireRuntimeSlot(): boolean {
  if (inFlight >= getRuntimeMaxInFlight()) return false
  inFlight += 1
  return true
}

export function releaseRuntimeSlot(): void {
  if (inFlight > 0) inFlight -= 1
}

/** Test-only: reset process-local counters. */
export function resetRuntimeConcurrencyForTests(max?: number): void {
  inFlight = 0
  maxOverride = max
}
