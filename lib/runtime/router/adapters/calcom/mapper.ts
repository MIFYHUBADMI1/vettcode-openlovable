import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getCalComDefaultEventTypeId } from "./config"

/**
 * Atai Runtime — Cal.com request/response mapper (server-only).
 *
 * Owns both translations for the `calendar` capability (Phase 10 §17).
 * Strict schemas: unknown fields are rejected, never forwarded. The caller
 * can never influence authentication, the endpoint, or the Cal.com account —
 * those come exclusively from trusted server configuration (§9/§53).
 *
 * List is read-only (safe, idempotent). Create is a real-world side effect
 * (§45/§46): one bounded attempt, no automatic retries.
 *
 * @module lib/runtime/router/adapters/calcom/mapper
 */

// ── listBookings ────────────────────────────────────────────────────────────

export const ListBookingsInputSchema = z
  .object({
    /** Cap the page size — Cal.com defaults to 25; the contract bounds it. */
    limit: z.number().int().min(1).max(50).optional(),
    status: z.enum(["upcoming", "past", "cancelled"]).optional(),
  })
  .strict()

export type ListBookingsInput = z.infer<typeof ListBookingsInputSchema>

export interface TranslatedListBookingsRequest {
  query: URLSearchParams
}

export function toCalComListBookings(input: unknown): TranslatedListBookingsRequest {
  const parsed = ListBookingsInputSchema.safeParse(input ?? {})
  if (!parsed.success) {
    throw invalid(`listBookings input validation failed: ${firstIssue(parsed)}`)
  }
  const query = new URLSearchParams()
  if (parsed.data.limit !== undefined) query.set("limit", String(parsed.data.limit))
  if (parsed.data.status !== undefined) query.set("status", parsed.data.status)
  return { query }
}

/** Provider-neutral booking item (safe metadata — no attendee PII beyond what the caller booked). */
export interface BookingItem {
  id: string
  uid: string
  title?: string
  start: string
  end?: string
  status?: string
  attendeeEmail?: string
  attendeeName?: string
  location?: string
}

export interface ListBookingsResultData {
  bookings: BookingItem[]
}

/** Documented Cal.com v2 bookings list response (subset the contract consumes). */
export interface CalComListBookingsResponse {
  status?: string
  data?: {
    bookings?: Array<{
      id?: number | string
      uid?: string
      title?: string
      start?: string
      end?: string
      status?: string
      location?: string | { type?: string; address?: string }
      attendee?: { email?: string; name?: string }
    }>
  }
}

export function toListBookingsResult(
  response: CalComListBookingsResponse,
): ProviderExecutionResponse<ListBookingsResultData> {
  const bookings = response.data?.bookings
  if (!Array.isArray(bookings)) {
    throw new ProviderExecutionError(
      "provider_error",
      "The scheduling provider returned an invalid response.",
      "missing data.bookings array",
    )
  }
  const items: BookingItem[] = []
  for (const b of bookings) {
    // A booking without a uid cannot be referenced back — skip rather than
    // fabricate identifiers. Same for `start`: the provider-neutral contract
    // requires it, and a missing timestamp must never be silently invented.
    if (typeof b?.uid !== "string" || b.uid.length === 0) continue
    if (typeof b.start !== "string" || b.start.length === 0) continue
    items.push({
      id: typeof b.id === "number" || typeof b.id === "string" ? String(b.id) : b.uid,
      uid: b.uid,
      ...(typeof b.title === "string" ? { title: b.title } : {}),
      start: b.start,
      ...(typeof b.end === "string" ? { end: b.end } : {}),
      ...(typeof b.status === "string" ? { status: b.status } : {}),
      ...(typeof b.attendee?.email === "string" ? { attendeeEmail: b.attendee.email } : {}),
      ...(typeof b.attendee?.name === "string" ? { attendeeName: b.attendee.name } : {}),
      ...(typeof b.location === "string"
        ? { location: b.location }
        : typeof b.location?.address === "string"
          ? { location: b.location.address }
          : {}),
    })
  }
  // Read-only query; no billable usage unit reported by Cal.com (§56).
  return { provider: "calcom", data: { bookings: items } }
}

// ── createBooking ───────────────────────────────────────────────────────────

export const CreateBookingInputSchema = z
  .object({
    /** UTC start timestamp (ISO 8601), e.g. "2026-10-01T09:00:00Z". */
    start: z
      .string()
      .min(10)
      .max(40)
      .refine((s) => !Number.isNaN(Date.parse(s)), "start must be a parseable ISO 8601 timestamp"),
    /** The event type to book (platform account only). */
    eventTypeId: z.number().int().positive().optional(),
    /** The attendee being booked. */
    attendee: z
      .object({
        name: z.string().min(1).max(200),
        email: z.string().email().max(320),
        /** IANA timezone (e.g. "America/New_York"). */
        timeZone: z.string().min(1).max(64).optional(),
        /** E.164 phone for SMS-reminder event types. */
        phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "phoneNumber must be E.164").optional(),
        language: z.string().min(2).max(10).optional(),
      })
      .strict(),
    /** Optional meeting metadata (safe scalars only). */
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict()

export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>

export interface TranslatedCreateBookingRequest {
  body: {
    start: string
    eventTypeId: number
    attendee: {
      name: string
      email: string
      timeZone?: string
      phoneNumber?: string
      language?: string
    }
    metadata?: Record<string, string | number | boolean>
  }
}

/**
 * Translate validated Atai input into a Cal.com v2 create-booking body.
 * The event type comes from the caller (within the platform account) with
 * the server-configured default as fallback — never another account.
 */
export function toCalComCreateBooking(input: unknown): TranslatedCreateBookingRequest {
  const eventTypeId = getCalComDefaultEventTypeId()
  const parsed = CreateBookingInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`createBooking input validation failed: ${firstIssue(parsed)}`)
  }
  const resolvedEventTypeId = parsed.data.eventTypeId ?? eventTypeId
  if (!resolvedEventTypeId) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      "no eventTypeId provided and no CALCOM_DEFAULT_EVENT_TYPE_ID configured",
    )
  }
  const v = parsed.data
  return {
    body: {
      start: v.start,
      eventTypeId: resolvedEventTypeId,
      attendee: {
        name: v.attendee.name,
        email: v.attendee.email,
        ...(v.attendee.timeZone !== undefined ? { timeZone: v.attendee.timeZone } : {}),
        ...(v.attendee.phoneNumber !== undefined ? { phoneNumber: v.attendee.phoneNumber } : {}),
        ...(v.attendee.language !== undefined ? { language: v.attendee.language } : {}),
      },
      ...(v.metadata !== undefined ? { metadata: v.metadata } : {}),
    },
  }
}

/** Documented Cal.com v2 create-booking response (subset the contract consumes). */
export interface CalComCreateBookingResponse {
  status?: string
  data?: {
    id?: number | string
    uid?: string
    title?: string
    start?: string
    end?: string
    status?: string
    location?: string | { type?: string; address?: string }
    attendee?: { email?: string; name?: string }
  }
}

export interface CreateBookingResultData extends BookingItem {}

export function toCreateBookingResult(
  response: CalComCreateBookingResponse,
): ProviderExecutionResponse<CreateBookingResultData> {
  const b = response.data
  if (typeof b !== "object" || b === null || typeof b.uid !== "string" || b.uid.length === 0) {
    throw new ProviderExecutionError(
      "provider_error",
      "The scheduling provider returned an invalid response.",
      "missing booking uid in create response",
    )
  }
  const data: CreateBookingResultData = {
    id: typeof b.id === "number" || typeof b.id === "string" ? String(b.id) : b.uid,
    uid: b.uid,
    ...(typeof b.title === "string" ? { title: b.title } : {}),
    // Cal.com v2 create responses always echo `start`; when a provider
    // response ever omits it, fail normalized rather than fabricate a time.
    ...(typeof b.start === "string" && b.start.length > 0
      ? { start: b.start }
      : (() => {
          throw new ProviderExecutionError(
            "provider_error",
            "The scheduling provider returned an invalid response.",
            "missing booking start in create response",
          )
        })()),
    ...(typeof b.end === "string" ? { end: b.end } : {}),
    ...(typeof b.status === "string" ? { status: b.status } : {}),
    ...(typeof b.attendee?.email === "string" ? { attendeeEmail: b.attendee.email } : {}),
    ...(typeof b.attendee?.name === "string" ? { attendeeName: b.attendee.name } : {}),
    ...(typeof b.location === "string"
      ? { location: b.location }
      : typeof b.location?.address === "string"
        ? { location: b.location.address }
        : {}),
  }
  // Side-effect op: no provider-reported usage unit (§56 — unknown ≠ 0).
  return { provider: "calcom", data }
}

// ── Shared ──────────────────────────────────────────────────────────────────

function invalid(detail: string): ProviderExecutionError {
  return new ProviderExecutionError(
    "unsupported_operation",
    "The request body is invalid for this capability.",
    detail,
  )
}

function firstIssue(parsed: { error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> } }): string {
  const issue = parsed.error.issues[0]
  return `${issue?.path.join(".") ?? "unknown"} ${issue?.message ?? ""}`.trim()
}
