import { describe, it, expect, afterEach } from "vitest"
import { getMongoPoolOptions } from "./mongodb"

describe("getMongoPoolOptions", () => {
  const prevPool = process.env.MONGODB_MAX_POOL_SIZE
  const prevWait = process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS

  afterEach(() => {
    if (prevPool === undefined) delete process.env.MONGODB_MAX_POOL_SIZE
    else process.env.MONGODB_MAX_POOL_SIZE = prevPool
    if (prevWait === undefined) delete process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS
    else process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS = prevWait
  })

  it("defaults to a pool larger than 10 with a fail-fast wait queue", () => {
    delete process.env.MONGODB_MAX_POOL_SIZE
    delete process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS
    const opts = getMongoPoolOptions()
    expect(opts.maxPoolSize).toBeGreaterThanOrEqual(50)
    expect(opts.waitQueueTimeoutMS).toBeGreaterThan(0)
    expect(opts.waitQueueTimeoutMS).toBeLessThanOrEqual(30_000)
  })

  it("clamps nonsense pool sizes", () => {
    process.env.MONGODB_MAX_POOL_SIZE = "99999"
    expect(getMongoPoolOptions().maxPoolSize).toBe(200)
    process.env.MONGODB_MAX_POOL_SIZE = "1"
    expect(getMongoPoolOptions().maxPoolSize).toBe(10)
  })
})
