import { AppError, type ErrorCode } from "@/lib/errors"
import type { ToolOutcome } from "./types"

/**
 * Co-founder error vocabulary. Reuses the central error framework (codes,
 * statuses, safe messages) — no second error system. New codes cover
 * Co-founder-specific situations (spec sections 39, 58).
 */

export type CofounderErrorCode =
  | ErrorCode
  | "AGENT_LOOP_LIMIT"
  | "PENDING_ACTION_NOT_FOUND"
  | "PENDING_ACTION_EXPIRED"
  | "PENDING_ACTION_ALREADY_USED"
  | "PENDING_ACTION_REJECTED"
  | "PROJECT_AMBIGUOUS"
  | "PROJECT_NOT_IDENTIFIED"

/** Stop conditions for the bounded tool loop (spec section 39). */
const FATAL_CODES = new Set([
  "INSUFFICIENT_CREDITS",
  "UNAUTHORIZED_PROJECT_ACCESS",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "AGENT_RUNNING",
  "DEPLOYMENT_RUNNING",
  "PENDING_ACTION_EXPIRED",
  "PENDING_ACTION_ALREADY_USED",
])

export function isFatalCofounderError(code: string): boolean {
  return FATAL_CODES.has(code)
}

/** Wrap any thrown error into a structured tool outcome. Never leaks
 * internals — unknown errors become UNKNOWN with a safe message. */
export function toToolOutcome(error: unknown, fallbackMessage?: string): ToolOutcome {
  if (error instanceof AppError) {
    return {
      success: false,
      error: { code: error.code, message: error.message, fatal: isFatalCofounderError(error.code) },
    }
  }
  const code = (error as { code?: string } | null)?.code
  if (typeof code === "string" && FATAL_CODES.has(code)) {
    return {
      success: false,
      error: { code, message: (error as { message?: string }).message ?? fallbackMessage ?? "Action failed.", fatal: true },
    }
  }
  return {
    success: false,
    error: {
      code: "UNKNOWN",
      message: fallbackMessage ?? "Something went wrong while doing that. Please try again.",
    },
  }
}
