import "server-only"
import { z } from "zod"
import type { NormalizedProviderUsage, ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getTwilioSmsFromNumber, getTwilioWhatsappFromNumber } from "./config"

/**
 * Atai Runtime — Twilio request/response mapper (server-only).
 *
 * Serves `sms`/`send` and `whatsapp`/`send` (Phase 10 §14). Strict E.164
 * destination validation; the platform sender numbers are injected from
 * trusted server configuration — callers can never choose or spoof them.
 *
 * @module lib/runtime/router/adapters/twilio/mapper
 */

/** Twilio's documented maximum message body length. */
export const MAX_MESSAGE_BODY_CHARS = 1_600

const E164_PATTERN = /^\+[1-9]\d{6,14}$/

export const SmsSendInputSchema = z
  .object({
    to: z.string().regex(E164_PATTERN, "Destination must be a valid E.164 phone number (e.g. +15551234567)."),
    body: z.string().min(1).max(MAX_MESSAGE_BODY_CHARS),
  })
  .strict()

export const WhatsappSendInputSchema = SmsSendInputSchema

export type MessageSendInput = z.infer<typeof SmsSendInputSchema>

export interface MessageSendResultData {
  /** Twilio message SID — safe, non-secret correlation. */
  messageId: string
  /** Twilio delivery status (e.g. queued, sent). */
  status: string
  segments?: number
}

export interface TranslatedMessageRequest {
  /** Form-encoded Twilio Messages payload. */
  form: URLSearchParams
}

export function toTwilioSmsRequest(input: unknown): TranslatedMessageRequest {
  const from = getTwilioSmsFromNumber()
  if (!from) {
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The messaging provider is temporarily unavailable.",
      "no TWILIO_FROM_NUMBER configured for the platform SMS sender",
    )
  }
  return { form: buildForm(input, from, from) }
}

export function toTwilioWhatsappRequest(input: unknown): TranslatedMessageRequest {
  const from = getTwilioWhatsappFromNumber()
  if (!from) {
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The messaging provider is temporarily unavailable.",
      "no TWILIO_WHATSAPP_FROM_NUMBER configured for the platform WhatsApp sender",
    )
  }
  return { form: buildForm(input, `whatsapp:${from}`, `whatsapp:${from}`) }
}

function buildForm(input: unknown, toValue: string, fromValue: string): URLSearchParams {
  const parsed = SmsSendInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `send input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }
  // buildForm receives the E164-checked to/from; for WhatsApp both are
  // prefixed by the callers above. Re-validate defensively.
  const bareTo = toValue.replace(/^whatsapp:/, "")
  if (!E164_PATTERN.test(bareTo)) {
    throw new ProviderExecutionError("unsupported_operation", "The request body is invalid for this capability.", "invalid destination")
  }
  const form = new URLSearchParams()
  form.set("To", toValue)
  form.set("From", fromValue)
  form.set("Body", parsed.data.body)
  return form
}

/** Documented Twilio message resource (subset the contract consumes). */
export interface TwilioMessageResponse {
  sid?: string
  status?: string
  num_segments?: string | number
  price?: string | number | null
  price_unit?: string | null
}

export function toMessageResult(
  response: TwilioMessageResponse,
): ProviderExecutionResponse<MessageSendResultData> {
  if (typeof response?.sid !== "string" || response.sid.length === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The messaging provider returned an invalid response.",
      "missing sid in message response",
    )
  }
  const segments = typeof response.num_segments === "string" ? Number(response.num_segments) : response.num_segments
  const segmentsSafe = typeof segments === "number" && Number.isFinite(segments) && segments >= 0 ? Math.round(segments) : undefined

  // Provider-reported cost (§55/§56): Twilio reports price + price_unit for
  // finalized messages; absent/null stays UNAVAILABLE — never fabricated 0.
  const priceRaw = typeof response.price === "string" ? Number(response.price) : response.price
  const currency = typeof response.price_unit === "string" && response.price_unit ? response.price_unit.toUpperCase() : undefined
  let usage: NormalizedProviderUsage | undefined
  const metadata: Record<string, unknown> = {}
  if (segmentsSafe !== undefined) metadata.segments = segmentsSafe
  if (typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw !== 0 && currency) {
    // Twilio reports price as a negative amount from the account's
    // perspective — Atai records the positive provider cost.
    usage = {
      inputTokens: 0,
      outputTokens: 0,
      providerCost: Math.abs(priceRaw),
      providerCostCurrency: currency,
      providerCostSource: "provider_reported",
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    }
  } else if (Object.keys(metadata).length > 0) {
    usage = { inputTokens: 0, outputTokens: 0, metadata }
  }

  return {
    provider: "twilio",
    data: {
      messageId: response.sid,
      status: typeof response.status === "string" ? response.status : "unknown",
      ...(segmentsSafe !== undefined ? { segments: segmentsSafe } : {}),
    },
    ...(usage ? { usage } : {}),
  }
}
