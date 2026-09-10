/**
 * Unit tests for IdeaUnderstandingService
 * 
 * Tests the idea understanding generation stage including validation,
 * AI interaction, and response parsing.
 * 
 * Requirements: 14.1 (Unit test coverage)
 */

import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
import { IdeaUnderstandingService } from "./idea-understanding"
import { UnderstandingError } from "../errors"
import { ModelRegistry } from "../models/registry"
import type { IdeaUnderstanding } from "../../types/idea-understanding"

// Mock dependencies
vi.mock("server-only", () => ({}))

// Create a hoisted mock that can be referenced in vi.mock
const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}))

vi.mock("ai", () => ({
  generateText: mockGenerateText,
}))

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: vi.fn(() => ({
    chatModel: vi.fn(() => "mock-model"),
  })),
}))

vi.mock("../../logging/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("../models/registry")
vi.mock("../utils/retry", () => ({
  executeWithRetry: vi.fn((fn) => fn()),
}))

describe("IdeaUnderstandingService", () => {
  let service: IdeaUnderstandingService
  let mockModelRegistry: ModelRegistry
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock model registry
    mockModelRegistry = {
      getModelForStage: vi.fn().mockReturnValue({
        primary: "test-model",
        fallbacks: ["fallback-model"],
        maxTokens: 4000,
        temperature: 0.7,
      }),
      getFallbackModel: vi.fn().mockReturnValue({
        primary: "fallback-model",
        fallbacks: [],
        maxTokens: 4000,
        temperature: 0.7,
      }),
    } as any

    service = new IdeaUnderstandingService(mockModelRegistry)
  })

  describe("validateMinimumIdeaLength", () => {
    it("should accept ideas with 50 or more characters", async () => {
      const idea = "A todo list app where users can create, edit, and delete tasks with priorities"

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          purpose: "Task management",
          description: "A simple todo list application",
          targetUsers: ["Individual users"],
          userRoles: ["user"],
          coreFeatures: [],
          dataEntities: [],
          userFlows: [],
          technicalRequirements: [],
          suggestedFeatures: [],
        }),
        usage: { totalTokens: 500 },
      })

      await expect(service.generateUnderstanding(idea)).resolves.toBeDefined()
    })

    it("should reject ideas under 50 characters", async () => {
      const idea = "A todo app" // Only 11 characters

      await expect(service.generateUnderstanding(idea)).rejects.toThrow(UnderstandingError)
      await expect(service.generateUnderstanding(idea)).rejects.toThrow(/too short/)
    })

    it("should trim whitespace when checking length", async () => {
      const idea = "   Short   " // Only 5 characters after trim

      await expect(service.generateUnderstanding(idea)).rejects.toThrow(UnderstandingError)
    })
  })

  describe("generateUnderstanding", () => {
    const validIdea = "A task management system where teams can collaborate on projects, assign tasks, track progress, and communicate in real-time"

    it("should generate understanding for valid idea", async () => {
      const mockResponse = {
        purpose: "Team task management and collaboration",
        description: "A collaborative project management system",
        targetUsers: ["Teams", "Project managers"],
        userRoles: ["admin", "member"],
        coreFeatures: [
          {
            name: "Task Creation",
            description: "Create and assign tasks",
            confidence: "explicit" as const,
          },
        ],
        dataEntities: [
          {
            name: "Task",
            fields: ["title", "description", "assignee", "status"],
            confidence: "inferred" as const,
          },
        ],
        userFlows: [
          {
            name: "Create Task Flow",
            steps: ["Login", "Navigate to project", "Click create task", "Fill form", "Submit"],
            confidence: "inferred" as const,
          },
        ],
        technicalRequirements: [
          {
            category: "authentication",
            requirement: "User authentication and authorization",
            confidence: "inferred" as const,
          },
        ],
        authenticationNeeds: {
          required: true,
          description: "Multi-user system requires authentication",
          suggestedProviders: ["Email/Password", "OAuth"],
        },
        suggestedFeatures: [
          {
            key: "Authentication",
            reason: "Multi-user system",
          },
        ],
      }

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify(mockResponse),
        usage: { totalTokens: 1200 },
      })

      const result = await service.generateUnderstanding(validIdea)

      expect(result).toBeDefined()
      expect(result.purpose).toBe(mockResponse.purpose)
      expect(result.coreFeatures).toHaveLength(1)
      expect(result.coreFeatures[0]?.confidence).toBe("explicit")
      expect(result.createdAt).toBeDefined()
      expect(result.modelUsed).toBeDefined()
    })

    it("should extract JSON from markdown code fence", async () => {
      const mockResponse = {
        purpose: "Test app",
        description: "A test application",
        targetUsers: ["Users"],
        userRoles: ["user"],
        coreFeatures: [],
        dataEntities: [],
        userFlows: [],
        technicalRequirements: [],
        suggestedFeatures: [],
      }

      mockGenerateText.mockResolvedValue({
        text: "```json\n" + JSON.stringify(mockResponse, null, 2) + "\n```",
        usage: { totalTokens: 500 },
      })

      const result = await service.generateUnderstanding(validIdea)

      expect(result).toBeDefined()
      expect(result.purpose).toBe("Test app")
    })

    it("should extract JSON from text with surrounding content", async () => {
      const mockResponse = {
        purpose: "Test app",
        description: "A test application",
        targetUsers: ["Users"],
        userRoles: ["user"],
        coreFeatures: [],
        dataEntities: [],
        userFlows: [],
        technicalRequirements: [],
        suggestedFeatures: [],
      }

      mockGenerateText.mockResolvedValue({
        text: `Here is the analysis:\n\n${JSON.stringify(mockResponse)}\n\nHope this helps!`,
        usage: { totalTokens: 500 },
      })

      const result = await service.generateUnderstanding(validIdea)

      expect(result).toBeDefined()
      expect(result.purpose).toBe("Test app")
    })

    it("should add metadata to parsed understanding", async () => {
      const beforeTime = Date.now()

      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          purpose: "Test app",
          description: "A test application",
          targetUsers: ["Users"],
          userRoles: ["user"],
          coreFeatures: [],
          dataEntities: [],
          userFlows: [],
          technicalRequirements: [],
          suggestedFeatures: [],
        }),
        usage: { totalTokens: 500 },
      })

      const result = await service.generateUnderstanding(validIdea)

      const afterTime = Date.now()

      expect(result.createdAt).toBeGreaterThanOrEqual(beforeTime)
      expect(result.createdAt).toBeLessThanOrEqual(afterTime)
      expect(result.modelUsed).toBe("test-model")
    })

    it("should throw UnderstandingError on invalid JSON", async () => {
      mockGenerateText.mockResolvedValue({
        text: "This is not valid JSON at all",
        usage: { totalTokens: 100 },
      })

      await expect(service.generateUnderstanding(validIdea)).rejects.toThrow(UnderstandingError)
    })

    it("should throw UnderstandingError on schema validation failure", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          // Missing required fields
          purpose: "Test",
        }),
        usage: { totalTokens: 100 },
      })

      await expect(service.generateUnderstanding(validIdea)).rejects.toThrow(UnderstandingError)
    })

    it("should use model registry to get model config", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          purpose: "Test app",
          description: "A test application",
          targetUsers: ["Users"],
          userRoles: ["user"],
          coreFeatures: [],
          dataEntities: [],
          userFlows: [],
          technicalRequirements: [],
          suggestedFeatures: [],
        }),
        usage: { totalTokens: 500 },
      })

      await service.generateUnderstanding(validIdea)

      expect(mockModelRegistry.getModelForStage).toHaveBeenCalledWith("idea_understanding")
    })
  })

  describe("confidence level validation", () => {
    const validIdea = "A social media app for sharing photos with friends and family members worldwide"

    it("should accept explicit confidence levels", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          purpose: "Photo sharing",
          description: "Social media app",
          targetUsers: ["Users"],
          userRoles: ["user"],
          coreFeatures: [
            {
              name: "Photo Upload",
              confidence: "explicit",
            },
          ],
          dataEntities: [],
          userFlows: [],
          technicalRequirements: [],
          suggestedFeatures: [],
        }),
        usage: { totalTokens: 500 },
      })

      const result = await service.generateUnderstanding(validIdea)

      expect(result.coreFeatures[0]?.confidence).toBe("explicit")
    })

    it("should accept inferred confidence levels", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          purpose: "Photo sharing",
          description: "Social media app",
          targetUsers: ["Users"],
          userRoles: ["user"],
          coreFeatures: [],
          dataEntities: [
            {
              name: "Photo",
              fields: ["url", "caption"],
              confidence: "inferred",
            },
          ],
          userFlows: [],
          technicalRequirements: [],
          suggestedFeatures: [],
        }),
        usage: { totalTokens: 500 },
      })

      const result = await service.generateUnderstanding(validIdea)

      expect(result.dataEntities[0]?.confidence).toBe("inferred")
    })

    it("should reject invalid confidence levels", async () => {
      mockGenerateText.mockResolvedValue({
        text: JSON.stringify({
          purpose: "Photo sharing",
          description: "Social media app",
          targetUsers: ["Users"],
          userRoles: ["user"],
          coreFeatures: [
            {
              name: "Photo Upload",
              confidence: "suggested", // Invalid - should only be explicit or inferred
            },
          ],
          dataEntities: [],
          userFlows: [],
          technicalRequirements: [],
          suggestedFeatures: [],
        }),
        usage: { totalTokens: 500 },
      })

      await expect(service.generateUnderstanding(validIdea)).rejects.toThrow(UnderstandingError)
    })
  })
})



