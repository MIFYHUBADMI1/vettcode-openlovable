import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getResendFromAddress } from "./config"

/**
 * Atai Runtime — Resend request/response mapper (server-only).
 *
 * The caller NEVER supplies the sender: `from` comes exclusively from the
 * trusted server configuration (§13 — no unauthorized sender spoofing from
 * generated applications). Strict schema; unknown fields rejected, never
 * forwarded.
 *
 * @module lib/runtime/router/adapters/resend/mapper
 */

const MAX_RECIPIENTS = 50
const MAX_SUBJECT_CHARS = 200
const MAX_TEXT_CHARS = 100_000
const MAX_HTML_CHARS = 200_000

export const EmailSendInputSchema = z
  .object({
    to: z.array(z.string().email().max(320)).min(1).max(MAX_RECIPIENTS),
    subject: z.string().min(1).max(MAX_SUBJECT_CHARS),
    text: z.string().min(1).max(MAX_TEXT_CHARS).optional(),
    html: z.string().min(1).max(MAX_HTML_CHARS).optional(),
    replyTo: z.string().email().max(320).optional(),
  })
  .strict()
  .refine((v) => v.text !== undefined || v.html !== undefined, {
    message: "Either text or html content is required.",
  })

export type EmailSendInput = z.infer<typeof EmailSendInputSchema>

export interface EmailSendResultData {
  /** Resend email id — safe, non-secret correlation. */
  id: string
}

export interface TranslatedEmailRequest {
  body: {
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    reply_to?: string
  }
}

/**
 * Translate validated Atai input into a Resend send request. The platform
 * sender is injected here from server config; a missing RESEND_FROM_EMAIL
 * fails as a provider configuration problem BEFORE the provider is called.
 */
export function toResendRequest(input: unknown): TranslatedEmailRequest {
  const from = getResendFromAddress()
  if (!from) {
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The email provider is temporarily unavailable.",
      "no RESEND_FROM_EMAIL configured for the platform sender",
    )
  }

  const parsed = EmailSendInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `email.send input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }

  const v = parsed.data
  return {
    body: {
      from,
      to: v.to,
      subject: v.subject,
      ...(v.text !== undefined ? { text: v.text } : {}),
      ...(v.html !== undefined ? { html: v.html } : {}),
      ...(v.replyTo !== undefined ? { reply_to: v.replyTo } : {}),
    },
  }
}

/** Documented Resend send response. */
export interface ResendSendResponse {
  id?: string
}

export function toEmailSendResult(response: ResendSendResponse): ProviderExecutionResponse<EmailSendResultData> {
  if (typeof response?.id !== "string" || response.id.length === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The email provider returned an invalid response.",
      "missing id in send response",
    )
  }
  // No token usage; provider cost is unknown (§56) — no usage reported.
  return { provider: "resend", data: { id: response.id } }
}
