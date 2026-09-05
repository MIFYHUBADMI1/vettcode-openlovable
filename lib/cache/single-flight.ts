/**
 * Single-flight request deduplication.
 *
 * When multiple concurrent requests arrive for the same expensive operation
 * (e.g. 50 SWR clients hitting /api/me on a page load), only the first one
 * does the real work. The rest await the same Promise and get the same result.
 *
 * This eliminates the thundering-herd of DB queries that shows up in your logs
 * as dozens of nearly-identical requests completing within milliseconds of each
 * other.
 *
 * Usage:
 *   const getUser = singleFlight<User>('getUser:' + userId)
 *   const user = await getUser(() => db.findUser(userId))
 */

export function singleFlight<T>(key: string) {
  type FleetResolve = (value: T | PromiseLike<T>) => void
  type FleetReject = (reason: unknown) => void

  const fleet = new Map<string, { promise: Promise<T>; resolves: FleetResolve[]; rejects: FleetReject[] }>()

  function flight(fn: () => Promise<T>): Promise<T> {
    const existing = fleet.get(key)
    if (existing) {
      // Another request is already in flight — queue behind it.
      return new Promise<T>((resolve, reject) => {
        existing.resolves.push(resolve)
        existing.rejects.push(reject)
      })
    }

    const entry: { promise: Promise<T>; resolves: FleetResolve[]; rejects: FleetReject[] } = {
      resolves: [],
      rejects: [],
      promise: undefined as unknown as Promise<T>,
    }

    entry.promise = (async () => {
      try {
        const result = await fn()
        // Resolve all waiters.
        for (const r of entry.resolves) r(result)
        return result
      } catch (err) {
        // Reject all waiters.
        for (const r of entry.rejects) r(err)
        throw err
      } finally {
        fleet.delete(key)
      }
    })()

    fleet.set(key, entry)
    return entry.promise
  }

  return flight
}
