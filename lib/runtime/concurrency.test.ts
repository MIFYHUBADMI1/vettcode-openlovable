import { describe, it, expect, beforeEach } from "vitest"
import {
  tryAcquireRuntimeSlot,
  releaseRuntimeSlot,
  runtimeInFlight,
  resetRuntimeConcurrencyForTests,
  getRuntimeMaxInFlight,
} from "./concurrency"

describe("runtime in-process concurrency cap", () => {
  beforeEach(() => {
    resetRuntimeConcurrencyForTests(3)
  })

  it("rejects work beyond the process cap without queuing", () => {
    expect(tryAcquireRuntimeSlot()).toBe(true)
    expect(tryAcquireRuntimeSlot()).toBe(true)
    expect(tryAcquireRuntimeSlot()).toBe(true)
    expect(tryAcquireRuntimeSlot()).toBe(false)
    expect(runtimeInFlight()).toBe(3)
  })

  it("releases slots so later requests can proceed", () => {
    expect(tryAcquireRuntimeSlot()).toBe(true)
    expect(tryAcquireRuntimeSlot()).toBe(true)
    expect(tryAcquireRuntimeSlot()).toBe(true)
    releaseRuntimeSlot()
    expect(tryAcquireRuntimeSlot()).toBe(true)
    expect(runtimeInFlight()).toBe(3)
  })

  it("simulated burst: 50 concurrent attempts against a cap of 5", async () => {
    resetRuntimeConcurrencyForTests(5)
    const results = await Promise.all(
      Array.from({ length: 50 }, async () => {
        if (!tryAcquireRuntimeSlot()) return "rejected"
        await new Promise((r) => setTimeout(r, 5))
        releaseRuntimeSlot()
        return "ok"
      }),
    )
    expect(results.filter((r) => r === "ok")).toHaveLength(5)
    expect(results.filter((r) => r === "rejected")).toHaveLength(45)
    expect(runtimeInFlight()).toBe(0)
  })

  it("default cap is a bounded production value", () => {
    resetRuntimeConcurrencyForTests(undefined)
    expect(getRuntimeMaxInFlight()).toBeGreaterThanOrEqual(4)
    expect(getRuntimeMaxInFlight()).toBeLessThanOrEqual(256)
  })
})
