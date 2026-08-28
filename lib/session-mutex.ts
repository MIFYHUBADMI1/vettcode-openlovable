// lib/session-mutex.ts
// Per-session mutex that prevents concurrent duplicate operations (e.g.
// sandbox creation) for the same session key.
//
// Usage:
//   const result = await sessionMutex.run('session-123', async () => {
//     return await createSandbox();
//   });
//
// A second call with the same key while the first is in-flight will await
// the first call's result instead of starting a duplicate operation.

type MutexEntry = {
  promise: Promise<unknown>;
  refCount: number;
};

class SessionMutex {
  private locks = new Map<string, MutexEntry>();

  /**
   * Execute `fn` under a per-key mutex. If another call for the same key is
   * already in flight, the caller awaits that call's result instead of
   * running `fn` again.
   *
   * @param key     Session / resource identifier.
   * @param fn      Work function whose return value is shared by all waiters.
   * @returns       The result of `fn` (or the in-flight call's result).
   */
  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.locks.get(key);

    if (existing) {
      // Another call is in flight — bump the reference count and wait.
      existing.refCount++;
      try {
        return (await existing.promise) as T;
      } finally {
        existing.refCount--;
        if (existing.refCount <= 0) {
          this.locks.delete(key);
        }
      }
    }

    // No existing call — we are the leader.
    const entry: MutexEntry = {
      promise: null as unknown as Promise<unknown>,
      refCount: 1,
    };

    // Register the lock BEFORE calling fn() so that isLocked() returns true
    // while the work function is running.
    this.locks.set(key, entry);

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        entry.refCount--;
        if (entry.refCount <= 0) {
          this.locks.delete(key);
        }
      }
    })();

    entry.promise = promise;

    return promise as Promise<T>;
  }

  /**
   * Returns true when the given key has an in-flight operation.
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * Remove all locks. Useful for testing.
   */
  clear(): void {
    this.locks.clear();
  }
}

/** Shared singleton — one mutex per server process. */
export const sessionMutex = new SessionMutex();
