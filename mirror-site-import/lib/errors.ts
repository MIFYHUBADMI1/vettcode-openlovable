/**
 * Central error-code enum (spec section 28). Every code maps to an HTTP
 * status and a safe, user-facing message. Raw error details (stack traces,
 * driver errors) never reach the client — only `logger.error` sees them.
 */
export type ErrorCode =
  | "DATABASE_UNAVAILABLE"
  | "AUTHENTICATION_FAILED"
  | "GOOGLE_AUTH_FAILED"
  | "EMAIL_NOT_VERIFIED"
  | "EMAIL_UNAVAILABLE"
  | "VERIFICATION_EXPIRED"
  | "VERIFICATION_INVALID"
  | "VERIFICATION_RATE_LIMITED"
  | "IMAGE_UPLOAD_FAILED"
  | "TOTALUM_UNAVAILABLE"
  | "FIRECRAWL_UNAVAILABLE"
  | "INSUFFICIENT_CREDITS"
  | "PROJECT_NOT_FOUND"
  | "UNAUTHORIZED_PROJECT_ACCESS"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "EMAIL_ALREADY_REGISTERED"
  | "UNKNOWN"

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  DATABASE_UNAVAILABLE: "The database isn't available right now. Please try again shortly.",
  AUTHENTICATION_FAILED: "Incorrect email or password.",
  GOOGLE_AUTH_FAILED: "We couldn't sign you in with Google. Please try again.",
  EMAIL_NOT_VERIFIED: "Please verify your email address before continuing.",
  EMAIL_UNAVAILABLE: "Email delivery isn't configured right now.",
  VERIFICATION_EXPIRED: "This verification link has expired. Please request a new one.",
  VERIFICATION_INVALID: "This verification link is invalid.",
  VERIFICATION_RATE_LIMITED: "You've requested too many verification emails. Please wait before trying again.",
  IMAGE_UPLOAD_FAILED: "We couldn't upload that image. Please try a different file.",
  TOTALUM_UNAVAILABLE: "The build service isn't available right now.",
  FIRECRAWL_UNAVAILABLE: "The website analyzer isn't available right now.",
  INSUFFICIENT_CREDITS: "You don't have enough credits for this action.",
  PROJECT_NOT_FOUND: "We couldn't find this project.",
  UNAUTHORIZED_PROJECT_ACCESS: "You don't have access to this project.",
  UNAUTHORIZED: "Please sign in to continue.",
  RATE_LIMITED: "Too many attempts. Please wait and try again.",
  VALIDATION: "Please check your input and try again.",
  EMAIL_ALREADY_REGISTERED: "An account with this email already exists.",
  UNKNOWN: "Something went wrong. Please try again.",
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  DATABASE_UNAVAILABLE: 503,
  AUTHENTICATION_FAILED: 401,
  GOOGLE_AUTH_FAILED: 401,
  EMAIL_NOT_VERIFIED: 403,
  EMAIL_UNAVAILABLE: 503,
  VERIFICATION_EXPIRED: 410,
  VERIFICATION_INVALID: 400,
  VERIFICATION_RATE_LIMITED: 429,
  IMAGE_UPLOAD_FAILED: 400,
  TOTALUM_UNAVAILABLE: 503,
  FIRECRAWL_UNAVAILABLE: 503,
  INSUFFICIENT_CREDITS: 402,
  PROJECT_NOT_FOUND: 404,
  UNAUTHORIZED_PROJECT_ACCESS: 403,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  VALIDATION: 422,
  EMAIL_ALREADY_REGISTERED: 409,
  UNKNOWN: 500,
}

export class AppError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode, message?: string, status?: number) {
    super(message ?? ERROR_MESSAGES[code])
    this.code = code
    this.status = status ?? STATUS_BY_CODE[code]
    this.name = "AppError"
  }
}

export function statusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code] ?? 500
}

export function messageForCode(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.UNKNOWN
}
