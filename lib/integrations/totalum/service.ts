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
  DeployResponse,
  VersionItem,
  VersionDiffResponse,
  ServerLogsResponse,
  AccountInfo,
  SecretItem,
  SourceCodeResponse,
  AddCustomDomainRequest,
  AddCustomDomainResponse,
  FullConversationResponse,
  LogsResponse,
} from "./types"

export { isTotalumConfigured, TotalumError }

/**
 * Totalum service — clean, typed methods over the documented VCaaS endpoints.
 * React components and routes call these; they never issue raw fetches
 * (spec section 39).
 */

/** POST /projects/launch — create the project and start the initial build. */
export async function launchProject(req: LaunchProjectRequest): Promise<LaunchProjectResponse> {
  const raw = await totalumFetch<Record<string, unknown>>("POST", "/projects/launch", req, 60_000)
  console.log("[totalum] launchProject response", { raw })
  // Normalize the project id across common field names.
  const projectId = (raw.projectId ?? raw.project_id ?? raw.id ?? raw.projectID ?? raw.projectIdString) as string | undefined
  if (!projectId) {
    console.error("[totalum] launchProject: no projectId in response", { raw })
    throw new TotalumError("UNKNOWN", `Totalum launch succeeded but returned no project id. Response: ${JSON.stringify(raw).slice(0, 200)}`)
  }
  return { projectId, status: raw.status as string | undefined }
}

/** GET /projects/:id/agent/status — poll async agent progress. */
export async function getAgentStatus(projectId: string): Promise<AgentStatusResponse> {
  return totalumFetch<AgentStatusResponse>("GET", `/projects/${encodeURIComponent(projectId)}/agent/status`)
}

/** GET /projects/:id/agent/full-conversation — full conversation history. */
export async function getFullConversation(projectId: string): Promise<FullConversationResponse> {
  return totalumFetch<FullConversationResponse>("GET", `/projects/${encodeURIComponent(projectId)}/agent/full-conversation`)
}

/** POST /projects/:id/agent/stop — send stop signal to running agent. */
export async function stopAgent(projectId: string): Promise<{ message: string }> {
  return totalumFetch<{ message: string }>("POST", `/projects/${encodeURIComponent(projectId)}/agent/stop`)
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
export async function getSourceCode(projectId: string): Promise<SourceCodeResponse> {
  const raw = await totalumFetch<Record<string, unknown>>("GET", `/projects/${encodeURIComponent(projectId)}/source-code`, undefined, 60_000)
  console.log("[totalum] getSourceCode response", { projectId, filesCount: raw.filesCount, hasDownloadUrl: Boolean(raw.downloadUrl), mode: raw.mode })
  return {
    filesCount: (raw.filesCount as number) ?? 0,
    lastCommitSha: raw.lastCommitSha as string | undefined,
    downloadUrl: (raw.downloadUrl as string | null) ?? null,
    mode: raw.mode as string | undefined,
  }
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


/** GET /account — retrieve credit balance and account details. */
export async function getAccountInfo(): Promise<AccountInfo> {
  return totalumFetch<AccountInfo>("GET", "/account")
}
/** PATCH /projects/:projectId — update label, description, or group. */
export async function updateProject(
  projectId: string,
  patch: { label?: string | null; description?: string | null; groupId?: string | null },
): Promise<{ projectId: string; label?: string; description: string; groupId?: string }> {
  return totalumFetch("PATCH", `/projects/${encodeURIComponent(projectId)}`, patch)
}

/** PATCH /projects/:projectId/credit-limits — set monthly spending caps. */
export async function setProjectCreditLimits(
  projectId: string,
  limits: { maxDevelopmentCreditsPerMonth?: number | null; maxInfrastructureCreditsPerMonth?: number | null },
): Promise<{ creditLimits: { maxDevelopmentCreditsPerMonth: number | null; maxInfrastructureCreditsPerMonth: number | null } }> {
  return totalumFetch("PATCH", `/projects/${encodeURIComponent(projectId)}/credit-limits`, limits)
}
/** GET /projects/:id/versions — list version history. */
export async function listVersions(projectId: string, limit = 20, skip = 0): Promise<{ versions: VersionItem[]; totalCount: number }> {
  return totalumFetch<{ versions: VersionItem[]; totalCount: number }>("GET", `/projects/${encodeURIComponent(projectId)}/versions?limit=${limit}&skip=${skip}`)
}

/** GET /projects/:id/version-diff — unified diff for a version. */
export async function getVersionDiff(projectId: string, commitSha: string): Promise<VersionDiffResponse> {
  return totalumFetch<VersionDiffResponse>("GET", `/projects/${encodeURIComponent(projectId)}/version-diff?commitSha=${encodeURIComponent(commitSha)}`)
}

/** POST /projects/:id/versions/:versionId/recover — restore a previous version. */
export async function recoverVersion(projectId: string, versionId: string): Promise<{ message: string }> {
  return totalumFetch<{ message: string }>("POST", `/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/recover`)
}

/** GET /projects/:id/backend/dev/logs — dev server logs. */
export async function getDevLogs(projectId: string): Promise<LogsResponse> {
  return totalumFetch<LogsResponse>("GET", `/projects/${encodeURIComponent(projectId)}/backend/dev/logs`)
}

/** GET /projects/:id/backend/prod/logs — production logs. */
export async function getProdLogs(projectId: string, opts?: { getOnlyLastLogs?: boolean; regexSearch?: string }): Promise<LogsResponse> {
  const params = new URLSearchParams()
  if (opts?.getOnlyLastLogs) params.set("getOnlyLastLogs", "true")
  if (opts?.regexSearch) params.set("regexSearch", opts.regexSearch)
  const qs = params.toString()
  return totalumFetch<LogsResponse>("GET", `/projects/${encodeURIComponent(projectId)}/backend/prod/logs${qs ? `?${qs}` : ""}`)
}

/** POST /projects/:id/deployments/deploy — publish to production. */
export async function deployProject(projectId: string): Promise<DeployResponse> {
  return totalumFetch<DeployResponse>("POST", `/projects/${encodeURIComponent(projectId)}/deployments/deploy`, undefined, 60_000)
}

/** GET /projects/:id/deployments/status — poll deployment progress. */
export async function getDeploymentStatus(projectId: string): Promise<DeploymentStatusResponse> {
  return totalumFetch<DeploymentStatusResponse>("GET", `/projects/${encodeURIComponent(projectId)}/deployments/status`)
}

/** PUT /projects/:id/domain — attach a custom domain. */
export async function addCustomDomain(projectId: string, req: AddCustomDomainRequest): Promise<AddCustomDomainResponse> {
  return totalumFetch<AddCustomDomainResponse>("PUT", `/projects/${encodeURIComponent(projectId)}/domain`, req, 30_000)
}

/** DELETE /projects/:id/domain — remove custom domain. */
export async function removeCustomDomain(projectId: string): Promise<{ message: string }> {
  return totalumFetch<{ message: string }>("DELETE", `/projects/${encodeURIComponent(projectId)}/domain`)
}
export async function getFiles(_projectId: string): Promise<never> {
  return documentationPending("getFiles")
}

/** GET /projects/:id — list secrets (values never returned). */
/** GET /projects/:id/database/tables-structure — retrieve all table definitions. */
export async function getDatabaseTables(projectId: string): Promise<import("./types").TablesStructureResponse> {
  return totalumFetch<import("./types").TablesStructureResponse>("GET", `/projects/${encodeURIComponent(projectId)}/database/tables-structure`)
}

/** POST /projects/:id/database/query — query records with filters, sorting, pagination. */
export async function queryDatabase(
  projectId: string,
  tableName: string,
  queryOptions?: import("./types").DatabaseQueryOptions,
): Promise<import("./types").DatabaseQueryResponse> {
  return totalumFetch<import("./types").DatabaseQueryResponse>("POST", `/projects/${encodeURIComponent(projectId)}/database/query`, {
    tableName,
    queryOptions,
  })
}

/** POST /projects/:id/database/records — create a new record. */
export async function createDatabaseRecord(
  projectId: string,
  tableName: string,
  data: Record<string, unknown>,
): Promise<import("./types").DatabaseRecordResponse> {
  return totalumFetch<import("./types").DatabaseRecordResponse>("POST", `/projects/${encodeURIComponent(projectId)}/database/records`, {
    tableName,
    data,
  })
}

/** PATCH /projects/:id/database/records/:recordId — edit an existing record. */
export async function editDatabaseRecord(
  projectId: string,
  tableName: string,
  recordId: string,
  data: Record<string, unknown>,
): Promise<import("./types").DatabaseRecordResponse> {
  return totalumFetch<import("./types").DatabaseRecordResponse>("PATCH", `/projects/${encodeURIComponent(projectId)}/database/records/${encodeURIComponent(recordId)}`, {
    tableName,
    data,
  })
}

/** DELETE /projects/:id/database/records/:recordId — delete a record. */
export async function deleteDatabaseRecord(
  projectId: string,
  tableName: string,
  recordId: string,
): Promise<import("./types").DatabaseDeleteRecordResponse> {
  return totalumFetch<import("./types").DatabaseDeleteRecordResponse>("DELETE", `/projects/${encodeURIComponent(projectId)}/database/records/${encodeURIComponent(recordId)}?tableName=${encodeURIComponent(tableName)}`)
}

/** POST /projects/:id/database/records/:recordId/link — link two records (many-to-many). */
export async function linkDatabaseRecords(
  projectId: string,
  tableName: string,
  recordId: string,
  propertyId: string,
  referenceId: string,
): Promise<import("./types").DatabaseLinkResponse> {
  return totalumFetch<import("./types").DatabaseLinkResponse>("POST", `/projects/${encodeURIComponent(projectId)}/database/records/${encodeURIComponent(recordId)}/link`, {
    tableName,
    propertyId,
    referenceId,
  })
}

/** DELETE /projects/:id/database/records/:recordId/link — unlink two records (many-to-many). */
export async function unlinkDatabaseRecords(
  projectId: string,
  tableName: string,
  recordId: string,
  propertyId: string,
  referenceId: string,
): Promise<import("./types").DatabaseUnlinkResponse> {
  return totalumFetch<import("./types").DatabaseUnlinkResponse>("DELETE", `/projects/${encodeURIComponent(projectId)}/database/records/${encodeURIComponent(recordId)}/link`, {
    tableName,
    propertyId,
    referenceId,
  })
}

export async function getSecrets(projectId: string): Promise<{ secrets: SecretItem[] }> {
  const data = await totalumFetch<TotalumProject>("GET", `/projects/${encodeURIComponent(projectId)}`)
  return { secrets: (data as Record<string, unknown> & { secrets?: SecretItem[] }).secrets ?? [] }
}

/** POST /projects/:id/secrets — create a secret. */
export async function createSecret(
  projectId: string,
  secret: { secretName: string; secretValue: string; environment?: string },
): Promise<SecretItem> {
  return totalumFetch<SecretItem>("POST", `/projects/${encodeURIComponent(projectId)}/secrets`, secret)
}

/** DELETE /projects/:id/secrets/:secretId — remove a secret. */
export async function deleteSecret(projectId: string, secretId: string): Promise<{ success: boolean }> {
  return totalumFetch<{ success: boolean }>("DELETE", `/projects/${encodeURIComponent(projectId)}/secrets/${encodeURIComponent(secretId)}`)
}

/** POST /projects/:projectId/agent/server/start-or-restart — restart the dev server. */
export async function startOrRestartServer(projectId: string): Promise<{ message: string; status: string }> {
  return totalumFetch<{ message: string; status: string }>("POST", `/projects/${encodeURIComponent(projectId)}/agent/server/start-or-restart`, undefined, 60_000)
}
