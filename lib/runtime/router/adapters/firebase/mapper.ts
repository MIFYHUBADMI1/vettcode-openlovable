import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Firebase request/response mapper (server-only).
 *
 * Serves `notifications`/`send` (Phase 10 §15): one push notification per
 * request to a single device token. Strict schema; unknown fields rejected,
 * never forwarded. The service-account credential is never part of the
 * contract (§15).
 *
 * @module lib/runtime/router/adapters/firebase/mapper
 */

/** FCM registration tokens are opaque; bound the length and character set. */
const MAX_TOKEN_CHARS = 4_096
const MAX_TITLE_CHARS = 250
const MAX_BODY_CHARS = 1_000

export const NotificationSendInputSchema = z
  .object({
    token: z.string().min(1).max(MAX_TOKEN_CHARS).regex(/^\S+$/, "Device token must not contain whitespace."),
    title: z.string().min(1).max(MAX_TITLE_CHARS),
    body: z.string().min(1).max(MAX_BODY_CHARS),
  })
  .strict()

export type NotificationSendInput = z.infer<typeof NotificationSendInputSchema>

export interface NotificationSendResultData {
  /** FCM message name — safe, non-secret correlation. */
  messageId: string
}

export interface TranslatedNotificationRequest {
  body: {
    message: {
      token: string
      notification: { title: string; body: string }
    }
  }
}

export function toFirebaseRequest(input: unknown): TranslatedNotificationRequest {
  const parsed = NotificationSendInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `notifications.send input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }
  return {
    body: {
      message: {
        token: parsed.data.token,
        notification: { title: parsed.data.title, body: parsed.data.body },
      },
    },
  }
}

/** Documented FCM v1 send response. */
export interface FcmSendResponse {
  name?: string
}

export function toNotificationResult(response: FcmSendResponse): ProviderExecutionResponse<NotificationSendResultData> {
  if (typeof response?.name !== "string" || response.name.length === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The notification provider returned an invalid response.",
      "missing name in send response",
    )
  }
  // No usage/cost is reported by FCM per message (§56: unknown ≠ 0).
  return { provider: "firebase", data: { messageId: response.name } }
}
