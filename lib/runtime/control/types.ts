import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"

export interface ProjectRuntimeLimits {
  requestsPerMinute?: number
  requestsPerDay?: number
}

export interface ProjectRuntimeConfig {
  projectId: string
  defaultModel?: string
  allowedModels: string[]
  fallbackModels: string[]
  allowEndUserModelSelection: boolean
  limits: ProjectRuntimeLimits
  createdAt: number
  updatedAt: number
}

export const DEFAULT_PROJECT_RUNTIME_CONFIG = {
  allowedModels: [] as string[],
  fallbackModels: [] as string[],
  allowEndUserModelSelection: true,
  limits: {} as ProjectRuntimeLimits,
}

export interface PublicUsageCost {
  status: "available" | "unavailable"
  amount?: number
  currency?: string
  source?: string
}

export interface PublicUsageEvent {
  id: string
  requestId: string
  apiKeyId: string
  environment: RuntimeEnvironment
  capability: string
  operation?: string
  provider: string
  model?: string
  status: "succeeded" | "failed"
  latencyMs: number
  creditsCharged: number
  errorCategory?: string
  createdAt: number
  usage?: Record<string, number>
  cost: PublicUsageCost
}

export interface UsageSummary {
  from: number
  to: number
  requests: number
  succeeded: number
  failed: number
  creditsCharged: number
  /** Sum of provider-reported USD when available; null if none were numeric. */
  providerCostUsd: number | null
  providerCostUnavailableCount: number
}
