/** Typed request/response models for the Totalum VCaaS integration.
 * Fields reflect the endpoints documented in the supplied architecture spec.
 * Capabilities whose exact request/response shape was NOT in the supplied
 * documentation are marked "documentation pending" in the service and are not
 * invented here (spec sections 8 & 49). */

export interface LaunchProjectRequest {
  projectId: string
  prompt: string
  maxDevelopmentCreditsPerMonth?: number
  maxInfrastructureCreditsPerMonth?: number
}

export interface LaunchProjectResponse {
  // Totalum may suffix the requested id if taken — always trust the returned id.
  projectId: string
  status?: string
}

export type AgentStatusValue = "queued" | "running" | "done" | "failed" | string

export interface AgentStatusResponse {
  status: AgentStatusValue
  messages?: Array<{ role: string; content: string; at?: string | number }>
  progress?: number
  error?: string
}

export interface TotalumProject {
  projectId: string
  status?: string
  developmentUrlFieldToUse?: "cachedDevelopmentUrl" | "temporalDevelopmentProjectUrl" | string
  cachedDevelopmentUrl?: string
  temporalDevelopmentProjectUrl?: string
  [key: string]: unknown
}

export interface RunAgentRequest {
  prompt: string
}

export interface CreditCosts {
  [operation: string]: number | { min?: number; max?: number }
}

export interface CreditBalance {
  developmentCredits?: number
  infrastructureCredits?: number
  [key: string]: unknown
}

export interface DeploymentStatusResponse {
  status: "building" | "deploying" | "success" | "failed" | string
  productionUrl?: string
  error?: string
}
