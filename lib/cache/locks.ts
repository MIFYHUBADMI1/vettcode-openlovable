/**
 * Lightweight in-memory locks for deduplication of concurrent operations.
 *
 * These are process-local locks — they prevent duplicate work within a single
 * server instance. For multi-instance deployments, you'd want Redis-based locks.
 *
 * Usage:
 *   const release = locks.acquire("key")
 *   if (!release) return // already locked
 *   try { // do work
 *   } finally { release() }
 */

export class LockManager {
  private held = new Set<string>()

  /**
   * Attempt to acquire a lock synchronously.
   * Returns a release function if the lock was acquired, or null if already held.
   */
  acquire(key: string): (() => void) | null {
    if (this.held.has(key)) return null
    this.held.add(key)
    let released = false
    return () => {
      if (!released) {
        released = true
        this.held.delete(key)
      }
    }
  }

  isLocked(key: string): boolean {
    return this.held.has(key)
  }
}

// Singleton instances
export const productCreationLocks = new LockManager()
export const checkoutSessionLocks = new LockManager()

/**
 * Simple in-memory rate limiter for short-lived operations.
 * Prevents rapid duplicate requests within a rolling time window.
 */
export class ShortLivedRateLimiter {
  private requests = new Map<string, { count: number; windowStart: number }>()
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs = 1000, maxRequests = 3) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  allowed(key: string): boolean {
    const now = Date.now()
    const existing = this.requests.get(key)

    if (!existing || now - existing.windowStart > this.windowMs) {
      this.requests.set(key, { count: 1, windowStart: now })
      return true
    }

    if (existing.count >= this.maxRequests) return false

    existing.count++
    return true
  }

  remaining(key: string): number {
    const now = Date.now()
    const existing = this.requests.get(key)
    if (!existing || now - existing.windowStart > this.windowMs) return this.maxRequests
    return Math.max(0, this.maxRequests - existing.count)
  }

  reset(key: string): void {
    this.requests.delete(key)
  }
}

// Rate limiter for checkout sessions: 2 requests per 30 seconds per user+product.
export const checkoutRateLimiter = new ShortLivedRateLimiter(30000, 2)
