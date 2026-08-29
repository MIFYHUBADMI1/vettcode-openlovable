import "server-only"
import { totalumFetch, isTotalumConfigured } from "./client"
import { TotalumError } from "./errors"
import type {
  LaunchProjectRequest,
  LaunchProjectResponse,
  AgentStatusResponse,
  TotalumProject,
  CreditCosts,
  CreditBalance,
  DeploymentStatusResponse,
} from "./types"

export { isTotalumConfigured, TotalumError }

/**
 * Totalum service — clean, typed methods over the documented VCaaS endpoints.
 * React components and routes call these; they never issue raw fetches
 * (spec section 39).
 */

/** POST /projects/launch — create the project and start the initial build. */
export async function launchProject(req: LaunchProjectRequest): Promise<LaunchProjectResponse> {
  return totalumFetch<LaunchProjectResponse>("POST", "/projects/launch", req, 60_000)
}

/** GET /projects/:id/agent/status — poll async agent progress. */
export async function getAgentStatus(projectId: string): Promise<AgentStatusResponse> {
  return totalumFetch<AgentStatusResponse>("GET", `/projects/${encodeURIComponent(projectId)}/agent/status`)
}

/** POST /projects/:id/agent/start — send a follow-up development prompt. */
export async function runAgent(projectId: string, prompt: string): Promise<{ status?: string }> {
  return totalumFetch("POST", `/projects/${encodeURIComponent(projectId)}/agent/start`, { prompt }, 60_000)
}

/** GET /projects/:id — full project record incl. development preview URLs. */
export async function getProject(projectId: string): Promise<TotalumProject> {
  return totalumFetch<TotalumProject>("GET", `/projects/${encodeURIComponent(projectId)}`)
}

/** GET /projects/:id/source-code — signed archive URL for latest source. */
export async function getSourceCode(projectId: string): Promise<{ downloadUrl: string }> {
  return totalumFetch<{ downloadUrl: string }>("GET", `/projects/${encodeURIComponent(projectId)}/source-code`, undefined, 60_000)
}

/** GET /credit-costs — current usage-based credit costs. Never hard-coded. */
export async function getCreditCosts(): Promise<CreditCosts> {
  return totalumFetch<CreditCosts>("GET", "/credit-costs")
}

/**
 * Resolve the correct development preview URL following the documented
 * precedence: use `developmentUrlFieldToUse` when present, otherwise prefer the
 * cached url and fall back to the temporal one (spec section 11).
 */
export function resolveDevelopmentUrl(project: TotalumProject): string | undefined {
  const field = project.developmentUrlFieldToUse
  if (field && typeof project[field] === "string") return project[field] as string
  return project.cachedDevelopmentUrl ?? project.temporalDevelopmentProjectUrl
}

/**
 * Capabilities below are referenced by the spec (deployment, stop, credit
 * balance/limits, files, database, secrets, versions) but their exact
 * request/response shapes were NOT in the supplied documentation. Per the
 * "do not invent endpoints" rule (spec sections 8 & 49), these surface a clear
 * "documentation pending" error rather than guessing a path. Fill in the
 * documented path/shape when the Totalum docs are provided.
 */
function documentationPending(capability: string): never {
  throw new TotalumError(
    "UNKNOWN",
    `Totalum "${capability}" endpoint is not documented in the supplied spec. Add the documented endpoint to enable it.`,
  )
}

export async function stopAgent(_projectId: string): Promise<never> {
  return documentationPending("stopAgent")
}
export async function getCreditBalance(): Promise<CreditBalance> {
  return documentationPending("getCreditBalance")
}
export async function setProjectCreditLimits(
  _projectId: string,
  _limits: { maxDevelopmentCreditsPerMonth?: number; maxInfrastructureCreditsPerMonth?: number },
): Promise<never> {
  return documentationPending("setProjectCreditLimits")
}
export async function deployProject(_projectId: string): Promise<never> {
  return documentationPending("deployProject")
}
export async function getDeploymentStatus(_projectId: string): Promise<DeploymentStatusResponse> {
  return documentationPending("getDeploymentStatus")
}
export async function getFiles(_projectId: string): Promise<never> {
  return documentationPending("getFiles")
}
export async function getDatabase(_projectId: string): Promise<never> {
  return documentationPending("getDatabase")
}
export async function getSecrets(_projectId: string): Promise<never> {
  return documentationPending("getSecrets")
}
