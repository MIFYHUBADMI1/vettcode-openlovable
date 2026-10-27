import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Supabase request/response mapper (server-only).
 *
 * Serves `notifications`/`send` through Supabase Realtime Broadcast. One
 * message per request. Channels are automatically namespaced by project so
 * one generated application can never broadcast into another application's
 * channel. Strict schema; unknown fields rejected, never forwarded.
 *
 * @module lib/runtime/router/adapters/supabase/mapper
 */

const MAX_CHANNEL_CHARS = 128
const MAX_EVENT_CHARS = 100
const MAX_TITLE_CHARS = 250
const MAX_BODY_CHARS = 1_000
const MAX_DATA_BYTES = 16 * 1024

/** Supabase Realtime topic/event names: no whitespace, no path separators. */
const CHANNEL_PATTERN = /^[A-Za-z0-9:_-]+$/
const EVENT_PATTERN = /^[A-Za-z0-9:_-]+$/

export const DEFAULT_NOTIFICATION_EVENT = "notification"

export const NotificationSendInputSchema = z
  .object({
    /** Realtime channel/topic the application's clients subscribe to. */
    channel: z
      .string()
      .min(1)
      .max(MAX_CHANNEL_CHARS)
      .regex(CHANNEL_PATTERN, "Channel may only contain letters, numbers, colons, underscores, and hyphens."),
    /** Event name subscribers listen for; defaults to "notification". */
    event: z
      .string()
      .min(1)
      .max(MAX_EVENT_CHARS)
      .regex(EVENT_PATTERN, "Event may only contain letters, numbers, colons, underscores, and hyphens.")
      .optional(),
    title: z.string().min(1).max(MAX_TITLE_CHARS),
    body: z.string().min(1).max(MAX_BODY_CHARS),
    /** Optional structured payload delivered alongside title/body. */
    data: z.record(z.string(), z.unknown()).optional(),
    /** Send on a private channel (subscribers must be authenticated). */
    private: z.boolean().optional(),
  })
  .strict()

export type NotificationSendInput = z.infer<typeof NotificationSendInputSchema>

export interface NotificationSendResultData {
  /** Fully-qualified topic after project scoping — safe, non-secret. */
  channel: string
  event: string
  accepted: boolean
}

export interface TranslatedNotificationRequest {
  channel: string
  event: string
  payload: {
    title: string
    body: string
    data?: Record<string, unknown>
  }
  privateChannel: boolean
}

/**
 * Namespace caller channels by project. The trusted project id comes from
 * the authenticated runtime context, never from request input.
 */
export function scopedChannel(projectId: string, channel: string): string {
  return `project:${projectId}:${channel}`
}

function invalidInput(message: string): ProviderExecutionError {
  return new ProviderExecutionError(
    "unsupported_operation",
    "The request body is invalid for this capability.",
    `notifications.send ${message}`,
  )
}

export function toSupabaseRequest(input: unknown, projectId: string): TranslatedNotificationRequest {
  const parsed = NotificationSendInputSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw invalidInput(
      `input validation failed: ${issue?.path.join(".") ?? "unknown"} ${issue?.message ?? ""}`.trim(),
    )
  }

  const v = parsed.data
  if (v.data !== undefined && Buffer.byteLength(JSON.stringify(v.data), "utf8") > MAX_DATA_BYTES) {
    throw invalidInput(`data must serialize to at most ${MAX_DATA_BYTES} bytes`)
  }

  return {
    channel: scopedChannel(projectId, v.channel),
    event: v.event ?? DEFAULT_NOTIFICATION_EVENT,
    payload: {
      title: v.title,
      body: v.body,
      ...(v.data !== undefined ? { data: v.data } : {}),
    },
    privateChannel: v.private === true,
  }
}

export function toNotificationResult(
  translated: TranslatedNotificationRequest,
): ProviderExecutionResponse<NotificationSendResultData> {
  // The broadcast HTTP endpoint acknowledges with a 2xx and no stable message
  // id, so acceptance (not provider-side delivery) is what can be reported.
  // No usage/cost is reported by Supabase per broadcast (unknown ≠ 0).
  return {
    provider: "supabase",
    data: {
      channel: translated.channel,
      event: translated.event,
      accepted: true,
    },
  }
}
