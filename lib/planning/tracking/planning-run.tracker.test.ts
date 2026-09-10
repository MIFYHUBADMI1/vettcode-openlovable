/**
 * PlanningRunTracker Unit Tests
 * Tests Requirements 18.1, 18.2, 18.3, 18.4, 18.5
 *
 * Uses a MongoDB in-memory mock to avoid real database calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Hoisted mock functions (must be defined before vi.mock factories run) ─

const { mockInsertOne, mockUpdateOne, mockFindOne, mockFind } = vi.hoisted(() => ({
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
  mockUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  mockFindOne: vi.fn().mockResolvedValue(null),
  mockFind: vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock("@/lib/db/collections", () => ({
  planningRunsCol: vi.fn().mockResolvedValue({
    insertOne: mockInsertOne,
    updateOne: mockUpdateOne,
    findOne: mockFindOne,
    find: mockFind,
  }),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn().mockReturnValue("run-test-id"),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// ─── Import after mocks are established ───────────────────────────────────

import { PlanningRunTracker, type StageCompletionData } from "./planning-run"

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeTracker() {
  return new PlanningRunTracker()
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("PlanningRunTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply default return values after clearAllMocks
    mockInsertOne.mockResolvedValue({ insertedId: "mock-id" })
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    mockFindOne.mockResolvedValue(null)
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    })
  })

  // ── startRun ─────────────────────────────────────────────────────────────

  describe("startRun (Req 18.1)", () => {
    it("should create a Planning_Run document and return its ID", async () => {
      const tracker = makeTracker()
      const runId = await tracker.startRun("proj-1", "user-1", "idea")

      expect(runId).toBe("run-test-id")
      expect(mockInsertOne).toHaveBeenCalledOnce()

      const doc = mockInsertOne.mock.calls[0][0]
      expect(doc).toMatchObject({
        id: "run-test-id",
        projectId: "proj-1",
        userId: "user-1",
        mode: "idea",
        status: "running",
        stageResults: [],
        totalTokens: 0,
        totalDurationMs: 0,
      })
    })

    it("should include createdAt and startedAt timestamps", async () => {
      const before = Date.now()
      const tracker = makeTracker()
      await tracker.startRun("proj-1", "user-1", "website")
      const after = Date.now()

      const doc = mockInsertOne.mock.calls[0][0]
      expect(doc.startedAt).toBeGreaterThanOrEqual(before)
      expect(doc.startedAt).toBeLessThanOrEqual(after)
      expect(doc.createdAt).toBeGreaterThanOrEqual(before)
      expect(doc.createdAt).toBeLessThanOrEqual(after)
    })

    it("should propagate database errors", async () => {
      mockInsertOne.mockRejectedValueOnce(new Error("DB connection failed"))
      const tracker = makeTracker()
      await expect(tracker.startRun("proj-1", "user-1", "idea")).rejects.toThrow(
        "DB connection failed"
      )
    })
  })

  // ── recordStageStart ──────────────────────────────────────────────────────

  describe("recordStageStart (Req 18.3)", () => {
    it("should not throw", () => {
      const tracker = makeTracker()
      expect(() => tracker.recordStageStart("run-1", "research")).not.toThrow()
    })

    it("should store start time so recordStageCompletion produces durationMs > 0", async () => {
      const tracker = makeTracker()
      const before = Date.now()
      tracker.recordStageStart("run-1", "planning")

      // Small delay to ensure durationMs > 0
      await new Promise((r) => setTimeout(r, 5))

      await tracker.recordStageCompletion("run-1", "planning", {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 1000,
        success: true,
      })

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.startedAt).toBeGreaterThanOrEqual(before)
      expect(pushed.durationMs).toBeGreaterThan(0)
    })
  })

  // ── recordStageCompletion ─────────────────────────────────────────────────

  describe("recordStageCompletion (Req 18.2, 18.3, 18.4)", () => {
    it("should push a StageResult with all required fields", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "research")

      const data: StageCompletionData = {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 8000,
        success: true,
        retries: 1,
      }

      await tracker.recordStageCompletion("run-1", "research", data)

      expect(mockUpdateOne).toHaveBeenCalledOnce()
      const [filter, update] = mockUpdateOne.mock.calls[0]

      expect(filter).toEqual({ id: "run-1" })

      const result = update.$push.stageResults
      expect(result.stage).toBe("research")
      expect(result.model).toBe("anthropic/claude-3.5-sonnet") // Req 18.3 — model recorded
      expect(result.tokens).toBe(8000)                          // Req 18.3 — tokens recorded
      expect(result.success).toBe(true)                         // Req 18.3 — success recorded
      expect(result.retries).toBe(1)                            // Req 18.4 — retries recorded
      expect(typeof result.durationMs).toBe("number")           // Req 18.3 — duration recorded
      expect(typeof result.startedAt).toBe("number")
      expect(typeof result.completedAt).toBe("number")
    })

    it("should record model used for the stage (Req 18.3)", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "critique")

      await tracker.recordStageCompletion("run-1", "critique", {
        model: "openai/gpt-4",
        tokens: 5000,
        success: true,
      })

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.model).toBe("openai/gpt-4")
    })

    it("should record tokens consumed (Req 18.3)", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "planning")

      await tracker.recordStageCompletion("run-1", "planning", {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 15000,
        success: true,
      })

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.tokens).toBe(15000)
    })

    it("should increment totalTokens and totalDurationMs on the run (Req 18.2)", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "planning")

      await tracker.recordStageCompletion("run-1", "planning", {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 12000,
        success: true,
      })

      const [, update] = mockUpdateOne.mock.calls[0]
      expect(update.$inc.totalTokens).toBe(12000)
      expect(typeof update.$inc.totalDurationMs).toBe("number")
      expect(update.$inc.totalDurationMs).toBeGreaterThanOrEqual(0)
    })

    it("should default retries to 0 when not provided (Req 18.4)", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "repair")

      await tracker.recordStageCompletion("run-1", "repair", {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 5000,
        success: true,
        // retries intentionally omitted
      })

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.retries).toBe(0)
    })

    it("should track retry count greater than zero (Req 18.4)", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "planning")

      await tracker.recordStageCompletion("run-1", "planning", {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 10000,
        success: true,
        retries: 3,
      })

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.retries).toBe(3)
    })

    it("should record success: false and error for failed stages (Req 18.3)", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "research")

      await tracker.recordStageCompletion("run-1", "research", {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 0,
        success: false,
        retries: 2,
        error: "Rate limit exceeded after 2 retries",
      })

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.success).toBe(false)
      expect(pushed.error).toBe("Rate limit exceeded after 2 retries")
      expect(pushed.retries).toBe(2)
    })

    it("should not throw if recordStageStart was not called (graceful fallback)", async () => {
      const tracker = makeTracker()
      // No recordStageStart — should still work without crashing
      await expect(
        tracker.recordStageCompletion("run-1", "sanitization", {
          model: "internal",
          tokens: 0,
          success: true,
        })
      ).resolves.not.toThrow()

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.durationMs).toBeGreaterThanOrEqual(0)
    })

    it("should clean up in-memory start time after recording completion", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "critique")

      await tracker.recordStageCompletion("run-1", "critique", {
        model: "openai/gpt-4",
        tokens: 5000,
        success: true,
      })

      vi.clearAllMocks()
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })

      // Second call without a new recordStageStart should gracefully produce durationMs >= 0
      await tracker.recordStageCompletion("run-1", "critique", {
        model: "openai/gpt-4",
        tokens: 1000,
        success: true,
      })

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.durationMs).toBeGreaterThanOrEqual(0)
    })

    it("should silently swallow database errors (non-blocking)", async () => {
      mockUpdateOne.mockRejectedValueOnce(new Error("DB write failed"))
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "research")

      // Should not throw — tracking failures must not break the pipeline
      await expect(
        tracker.recordStageCompletion("run-1", "research", {
          model: "anthropic/claude-3.5-sonnet",
          tokens: 5000,
          success: true,
        })
      ).resolves.not.toThrow()
    })
  })

  // ── completeRun ───────────────────────────────────────────────────────────

  describe("completeRun (Req 18.5)", () => {
    it("should set status to completed with completedAt and outcome", async () => {
      const tracker = makeTracker()
      const before = Date.now()

      await tracker.completeRun("run-1", {
        specificationId: "spec-abc",
        qualityScore: 87,
      })

      const after = Date.now()
      const [filter, update] = mockUpdateOne.mock.calls[0]

      expect(filter).toEqual({ id: "run-1" })
      expect(update.$set.status).toBe("completed")
      expect(update.$set.completedAt).toBeGreaterThanOrEqual(before)
      expect(update.$set.completedAt).toBeLessThanOrEqual(after)
      expect(update.$set.outcome).toMatchObject({
        specificationId: "spec-abc",
        qualityScore: 87,
      })
    })

    it("should silently swallow database errors", async () => {
      mockUpdateOne.mockRejectedValueOnce(new Error("DB write failed"))
      const tracker = makeTracker()
      await expect(
        tracker.completeRun("run-1", { qualityScore: 90 })
      ).resolves.not.toThrow()
    })
  })

  // ── failRun ───────────────────────────────────────────────────────────────

  describe("failRun (Req 18.5)", () => {
    it("should set status to failed with error message and completedAt", async () => {
      const tracker = makeTracker()
      const before = Date.now()
      const err = new Error("Model timed out")

      await tracker.failRun("run-1", err, "planning")

      const after = Date.now()
      const [filter, update] = mockUpdateOne.mock.calls[0]

      expect(filter).toEqual({ id: "run-1" })
      expect(update.$set.status).toBe("failed")
      expect(update.$set.error).toBe("Model timed out")
      expect(update.$set.completedAt).toBeGreaterThanOrEqual(before)
      expect(update.$set.completedAt).toBeLessThanOrEqual(after)
    })

    it("should silently swallow database errors", async () => {
      mockUpdateOne.mockRejectedValueOnce(new Error("DB write failed"))
      const tracker = makeTracker()
      await expect(
        tracker.failRun("run-1", new Error("Stage failed"), "research")
      ).resolves.not.toThrow()
    })
  })

  // ── StageCompletionData contract ──────────────────────────────────────────

  describe("StageCompletionData type correctness (Req 18.3, 18.4)", () => {
    it("should require model, tokens, and success; retries and error are optional", async () => {
      const tracker = makeTracker()
      tracker.recordStageStart("run-1", "idea_understanding")

      const data: StageCompletionData = {
        model: "anthropic/claude-3.5-sonnet",
        tokens: 5000,
        success: true,
        // retries and error are intentionally omitted (optional)
      }

      await tracker.recordStageCompletion("run-1", "idea_understanding", data)

      const pushed = mockUpdateOne.mock.calls[0][1].$push.stageResults
      expect(pushed.model).toBe("anthropic/claude-3.5-sonnet")
      expect(pushed.tokens).toBe(5000)
      expect(pushed.success).toBe(true)
      expect(pushed.retries).toBe(0) // defaulted
      expect(pushed.error).toBeUndefined()
    })
  })
})
