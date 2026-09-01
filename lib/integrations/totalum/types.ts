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

export interface RealtimeMessage {
  author: string
  message: string
  messageType: string
  createdAt: string
  versionId?: string
  gitDiffUrl?: string
  secretKeysNeeded?: Record<string, { isProvided: boolean; description: string }>
}

export interface AgentStatusResponse {
  status: AgentStatusValue
  messages?: Array<{ role: string; content: string; at?: string | number }>
  realtimeConversation?: RealtimeMessage[]
  progress?: number
  creditsSpent?: number
  error?: string
}

export interface TotalumProject {
  projectId: string
  status?: string
  deployment?: { status: string; createdAt?: string; versionId?: string } | null
  customDomain?: CustomDomainInfo | null
  productionProjectUrl?: string
  developmentUrlFieldToUse?: "cachedDevelopmentUrl" | "temporalDevelopmentProjectUrl" | string
  cachedDevelopmentUrl?: string
  temporalDevelopmentProjectUrl?: string
  agentProcessStatus?: string
  agentServerStatus?: string
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
  status: "deploying" | "success" | "error" | string | null
  createdAt?: string | null
  versionId?: string
}

export interface DeployResponse {
  projectId: string
  status: string
  message: string
}

export interface VersionItem {
  _id: string
  name: string
  commitSha?: string
  commitMessage?: string
  prompt?: string
  createdAt: string
  updatedAt: string
}

export interface VersionDiffResponse {
  commitSha: string
  diff: string
}

export interface FullConversationMessage {
  author: string
  message: string
  messageType: string
  createdAt: string
  versionId?: string
  gitDiffUrl?: string
  secretKeysNeeded?: Record<string, { isProvided: boolean; description: string }>
}

export interface FullConversationResponse {
  projectId: string
  conversation: FullConversationMessage[]
}

export interface LogsResponse {
  logs?: string
  records?: Array<{
    EventTimestampMs: number
    Outcome: string
    WallTimeMs: number
    CPUTimeMs: number
    Event: { Request: { URL: string; Method: string }; Response: { Status: number } }
    Logs: Array<{ Level: string; Message: string[]; TimestampMs: number }>
    Exceptions: Array<{ Name: string; Message: string; TimestampMs: number }>
  }>
}

export interface ServerLogsResponse {
  logs: string
}

export interface AccountInfo {
  credits: number
  recurrentCredits?: number
  oneTimeCredits?: number
}

export interface SecretItem {
  _id: string
  secretName: string
  environment: string
  createdAt?: string
}

/** GET /projects/:id/source-code — signed archive URL for latest source. */
export interface SourceCodeResponse {
  /** Total files in the project. */
  filesCount: number
  /** Latest git commit SHA. Absent on legacy projects. */
  lastCommitSha?: string
  /** Signed download URL (expires in minutes). Null on legacy projects. */
  downloadUrl: string | null
  /** Only present on legacy projects: "mongodb" means no archive, use tree/file endpoints. */
  mode?: string
}

/** PUT /projects/:id/domain — attach a custom domain. */
export interface AddCustomDomainRequest {
  hostname: string
}

export interface AddCustomDomainResponse {
  success: boolean
  hostname: string
  status: string
  dnsRecordsToAdd?: Array<{ type: string; name: string; value: string }>
}

/** Custom domain info from GET /projects/:id. */
export interface CustomDomainInfo {
  hostname: string
  status: string
  sslStatus?: string
  dnsRecordsToAdd?: Array<{ type: string; name: string; value: string }>
}

// ─── Database types ───────────────────────────────────────────────────────

export type DatabasePropertyType =
  | "string"
  | "number"
  | "date"
  | "options"
  | "file"
  | "long-string"
  | "objectReference"

export interface DatabaseProperty {
  id: string
  name: string
  propertyType: DatabasePropertyType
  label: string
  description?: string
  objectReference?: {
    targetTable: string
    relationType: "manyToOne" | "manyToMany" | "oneToMany"
  }
  typeExtras?: Record<string, unknown>
}

export interface DatabaseTable {
  _id: string
  type: string // table name (snake_case)
  label: string // human-friendly display name
  description?: string
  icon?: string
  properties: Record<string, DatabaseProperty>
}

export interface TablesStructureResponse {
  tables: DatabaseTable[]
}

export interface DatabaseQueryOptions {
  _filter?: Record<string, unknown>
  _sort?: Record<string, "asc" | "desc">
  _limit?: number
  _offset?: number
  _select?: Record<string, boolean>
  _omit?: Record<string, boolean>
  _count?: boolean
  _aggregate?: Record<string, unknown>
  _groupBy?: string | string[]
  [key: string]: unknown
}

export interface DatabaseQueryRequest {
  tableName: string
  queryOptions?: DatabaseQueryOptions
}

export interface DatabaseQueryResponse {
  results: Record<string, unknown>[]
  _count?: { _total: number }
}

export interface DatabaseCreateRecordRequest {
  tableName: string
  data: Record<string, unknown>
}

export interface DatabaseEditRecordRequest {
  tableName: string
  data: Record<string, unknown>
}

export interface DatabaseRecordResponse {
  _id: string
  [key: string]: unknown
}

export interface DatabaseDeleteRecordResponse {
  deleted: boolean
  recordId: string
}

export interface DatabaseLinkRequest {
  tableName: string
  propertyId: string
  referenceId: string
}

export interface DatabaseLinkResponse {
  linked: boolean
}

export interface DatabaseUnlinkResponse {
  unlinked: boolean
}
