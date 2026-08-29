/** Totalum error codes → friendly, user-facing messages (spec sections 28).
 * Raw technical errors are never shown to ordinary users. */

export type TotalumErrorCode =
  | "MISSING_PROJECT_ID"
  | "PROJECT_NOT_FOUND"
  | "INSUFFICIENT_CREDITS"
  | "MAX_PROJECTS_REACHED"
  | "RATE_LIMIT_EXCEEDED"
  | "SERVER_NOT_READY"
  | "PROJECT_CREDIT_LIMIT_REACHED"
  | "AGENT_RUNNING"
  | "DEPLOYMENT_RUNNING"
  | "NO_PROCESS_RUNNING"
  | "PROVIDER_NOT_CONFIGURED"
  | "UNKNOWN"

const FRIENDLY: Record<TotalumErrorCode, string> = {
  MISSING_PROJECT_ID: "Something went wrong starting this build. Please try again.",
  PROJECT_NOT_FOUND: "We couldn't find this project. It may have been removed.",
  INSUFFICIENT_CREDITS: "You don't have enough credits for this build. Please top up and try again.",
  MAX_PROJECTS_REACHED: "You've reached your project limit. Please remove a project or upgrade.",
  RATE_LIMIT_EXCEEDED: "Too many requests right now. Please wait a moment and try again.",
  SERVER_NOT_READY: "Your project is still starting up. Please try again in a few seconds.",
  PROJECT_CREDIT_LIMIT_REACHED: "This project has reached its monthly credit limit.",
  AGENT_RUNNING: "Your project is already being built. Please wait for the current build to finish.",
  DEPLOYMENT_RUNNING: "A deployment is already in progress. Please wait for it to finish.",
  NO_PROCESS_RUNNING: "There's no active build to stop.",
  PROVIDER_NOT_CONFIGURED:
    "The application builder isn't connected yet. Add your Totalum API key to enable building.",
  UNKNOWN: "Something went wrong. Please try again.",
}

export class TotalumError extends Error {
  code: TotalumErrorCode
  status?: number
  constructor(code: TotalumErrorCode, message?: string, status?: number) {
    super(message ?? code)
    this.code = code
    this.status = status
  }
  get friendlyMessage() {
    return FRIENDLY[this.code] ?? FRIENDLY.UNKNOWN
  }
}

export function friendlyMessageFor(code: string | undefined): string {
  return FRIENDLY[(code as TotalumErrorCode) ?? "UNKNOWN"] ?? FRIENDLY.UNKNOWN
}

/** Map an HTTP status + optional server code string to a TotalumError. */
export function mapTotalumError(status: number, body: string): TotalumError {
  const upper = body.toUpperCase()
  const known: TotalumErrorCode[] = [
    "MISSING_PROJECT_ID",
    "PROJECT_NOT_FOUND",
    "INSUFFICIENT_CREDITS",
    "MAX_PROJECTS_REACHED",
    "RATE_LIMIT_EXCEEDED",
    "SERVER_NOT_READY",
    "PROJECT_CREDIT_LIMIT_REACHED",
    "AGENT_RUNNING",
    "DEPLOYMENT_RUNNING",
    "NO_PROCESS_RUNNING",
  ]
  const found = known.find((c) => upper.includes(c))
  if (found) return new TotalumError(found, body, status)
  if (status === 429) return new TotalumError("RATE_LIMIT_EXCEEDED", body, status)
  if (status === 404) return new TotalumError("PROJECT_NOT_FOUND", body, status)
  if (status === 402) return new TotalumError("INSUFFICIENT_CREDITS", body, status)
  return new TotalumError("UNKNOWN", body, status)
}
