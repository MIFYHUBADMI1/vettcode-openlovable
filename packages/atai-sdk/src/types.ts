/**
 * Atai SDK — public types.
 *
 * These types mirror the Atai Runtime API contract (Phase 2/5/6) in
 * provider-neutral vocabulary. The SDK never exposes provider-specific
 * shapes: if Atai changes its underlying provider, these types keep
 * generated applications stable.
 *
 * @module types
 */

// ─── Configuration ─────────────────────────────────────────────────────────

/** Configuration for constructing an Atai client. */
export interface AtaiConfig {
  /**
   * Atai Runtime API key (`atai_<environment>_<secret>`). This is the
   * credential a generated application uses to authenticate with Atai —
   * never a provider credential.
   */
  apiKey: string
  /**
   * Atai Runtime API base URL. Defaults to Atai's production runtime
   * origin. Configuration-level only: individual requests can never
   * redirect traffic to another host.
   */
  baseUrl?: string
}

// ─── AI capability (mirrors the runtime `ai.text` chat contract) ───────────

/** Roles supported by the Atai AI chat operation. */
export type AiRole = "user" | "assistant" | "system"

/** One conversation message in provider-neutral form. */
export interface AiMessage {
  role: AiRole
  /** Message text (1–100,000 characters per the runtime contract). */
  content: string
}

/**
 * Input for `atai.ai.chat()`. Mirrors the runtime `ai.text`/`chat`
 * operation input exactly — the SDK serializes this verbatim.
 */
export interface AiChatInput {
  /** Conversation in provider-neutral form (1–128 messages). */
  messages: AiMessage[]
  /**
   * Optional caller-selected model identifier (e.g. "openai/gpt-5.2").
   * When omitted, Atai's configured default model is used.
   */
  model?: string
  temperature?: number
  top_p?: number
  max_tokens?: number
  /** Stop sequence(s) — a single string or up to 4 strings. */
  stop?: string | string[]
  frequency_penalty?: number
  presence_penalty?: number
  seed?: number
}

/** Token usage reported for one AI operation (safe numeric metadata). */
export interface AiUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  /** Provider-reported cost in USD, when the provider supplied one. */
  cost?: number
}

/**
 * Normalized result of one AI chat operation. Provider-neutral: the
 * application never sees a provider wire format.
 */
export interface AiChatResult {
  /** Non-secret correlation id for the generation. */
  id: string
  /** The model Atai actually used (may differ from the requested one). */
  model: string
  /** Assistant text content. */
  content: string
  /** Normalized finish reason (e.g. "stop", "length") or null. */
  finishReason: string | null
  usage?: AiUsage
}

// ─── Runtime envelope (mirrors the Runtime API response contract) ──────────

/** Envelope the Runtime API returns for every success (`ok: true`). */
export interface RuntimeEnvelope<T> {
  ok: true
  data: {
    requestId: string
    capability: string
    operation: string
    data: T
  }
}

/** Envelope the Runtime API returns for every failure (`ok: false`). */
export interface RuntimeErrorEnvelope {
  ok: false
  error: {
    code: string
    message: string
  }
}

/** Anything the Runtime API might return at HTTP level. */
export type RuntimeEnvelopeResult<T> = RuntimeEnvelope<T> | RuntimeErrorEnvelope

// ─── Request options ───────────────────────────────────────────────────────

/**
 * Per-call options. Deliberately narrow: no `baseUrl`, no headers, no
 * credentials. Cancellation uses the standard `AbortSignal`.
 */
export interface AtaiRequestOptions {
  /** Cancel the in-flight request when the environment supports it. */
  signal?: AbortSignal
}

// ─── Voice capability (mirrors the runtime `ai.speak`/`synthesize` contract) ──

/** Input for `atai.voice.synthesize()`. */
export interface VoiceSynthesizeInput {
  /** Text to synthesize (1–5,000 characters per the runtime contract). */
  text: string
  /** Optional voice identifier; Atai's configured default voice is used when omitted. */
  voiceId?: string
  /** Optional voice model from the runtime allowlist. */
  model?: string
}

/** Normalized result of one voice synthesis (audio arrives base64-encoded). */
export interface VoiceSynthesizeResult {
  audioBase64: string
  mimeType: string
  voiceId: string
  modelId: string
  characters: number
}

// ─── Web search capability (mirrors `search.web`/`web`) ────────────────────

export interface SearchWebInput {
  query: string
  limit?: number
}

export interface WebSearchResultItem {
  title: string
  url: string
  description?: string
}

export interface SearchWebResult {
  results: WebSearchResultItem[]
  creditsUsed?: number
}

// ─── Scrape capability (mirrors `web.scrape`/`scrape`) ─────────────────────

export interface WebScrapeInput {
  /** Absolute public http(s) URL to scrape. */
  url: string
}

export interface WebScrapeResult {
  url: string
  title?: string
  markdown?: string
  links?: string[]
  truncated?: boolean
  creditsUsed?: number
}

// ─── Email capability (mirrors `email`/`send`) ─────────────────────────────

export interface EmailSendInput {
  to: string[]
  subject: string
  text?: string
  html?: string
  replyTo?: string
}

export interface EmailSendResult {
  id: string
}

// ─── Messaging capabilities (mirrors `sms`/`send`, `whatsapp`/`send`) ──────

export interface MessageSendInput {
  /** Destination in E.164 form (e.g. "+15551234567"). */
  to: string
  body: string
}

export interface MessageSendResult {
  messageId: string
  status: string
  segments?: number
}

// ─── Push notification capability (mirrors `notifications`/`send`) ────────

export interface NotificationSendInput {
  /** Device token registered with the platform's notification service. */
  token: string
  title: string
  body: string
}

export interface NotificationSendResult {
  messageId: string
}

// ─── Maps capability (mirrors `maps`/`geocode`, `maps`/`reverseGeocode`) ──

export interface MapsGeocodeInput {
  query: string
  limit?: number
  country?: string
  language?: string
}

export interface MapsReverseGeocodeInput {
  longitude: number
  latitude: number
  limit?: number
}

export interface PlaceResult {
  id: string
  name: string
  formattedAddress?: string
  latitude: number
  longitude: number
}

export interface MapsResult {
  results: PlaceResult[]
}

// ─── Calendar capability (mirrors `calendar`/`listBookings`, `calendar`/`createBooking`) ──

export interface CalendarListBookingsInput {
  /** Filter by start date (ISO 8601). */
  startDate?: string
  /** Filter by end date (ISO 8601). */
  endDate?: string
  /** Maximum number of bookings to return. */
  limit?: number
}

export interface CalendarBooking {
  uid: string
  title?: string
  startTime: string
  endTime: string
  status: string
}

export interface CalendarListBookingsResult {
  bookings: CalendarBooking[]
}

export interface CalendarCreateBookingInput {
  /** Event title. */
  title: string
  /** Start time (ISO 8601). */
  startTime: string
  /** End time (ISO 8601). */
  endTime: string
  /** Optional attendee email(s). */
  attendees?: string[]
}

export interface CalendarCreateBookingResult {
  uid: string
  title?: string
  startTime: string
  endTime: string
  status: string
}

// ─── Vector capability (mirrors `vectors`/`upsert`, `vectors`/`search`, `vectors`/`delete`) ──

export interface VectorUpsertInput {
  vectors: Array<{
    id: string
    values: number[]
    metadata?: Record<string, unknown>
  }>
}

export interface VectorUpsertResult {
  count: number
}

export interface VectorSearchInput {
  vector: number[]
  topK?: number
  filter?: Record<string, unknown>
}

export interface VectorMatch {
  id: string
  score: number
  metadata?: Record<string, unknown>
}

export interface VectorSearchResult {
  matches: VectorMatch[]
  count: number
}

export interface VectorDeleteInput {
  ids: string[]
}

export interface VectorDeleteResult {
  count: number
}

// ─── Database capability (mirrors `db`/`query`, `db`/`create`, `db`/`edit`, `db`/`delete`) ──

export interface DbQueryInput {
  tableName: string
  filter?: Record<string, unknown>
  limit?: number
  skip?: number
  sortBy?: string
  sortDirection?: "asc" | "desc"
}

export interface DbQueryResult {
  records: unknown[]
  total?: number
}

export interface DbCreateInput {
  tableName: string
  data: Record<string, unknown>
}

export interface DbCreateResult {
  record: Record<string, unknown>
  id?: string
}

export interface DbEditInput {
  tableName: string
  recordId: string
  data: Record<string, unknown>
}

export interface DbEditResult {
  record: Record<string, unknown>
  id?: string
}

export interface DbDeleteInput {
  tableName: string
  recordId: string
}

export interface DbDeleteResult {
  success: true
}

// ─── Health capability (mirrors `GET /api/runtime/v1/health`) ──

/**
 * Normalized result of the runtime health check (`atai.health.check()`).
 * Safe metadata only — never includes the API key or provider details.
 */
export interface AtaiHealthResult {
  /** "operational" — the runtime authenticated the key and responded. */
  status: string
  /** Non-secret correlation ID for support/debugging. */
  requestId: string
  /** Safe identity metadata derived server-side from the key record. */
  identity: {
    projectId: string
    environment: string
    apiKeyId: string
    scopes: string[]
  }
  /** Credential status as evaluated by the runtime. */
  key: {
    status: string
  }
  /** The runtime's documented request-lifecycle stage names. */
  lifecycle: string[]
}

// ─── Payments capability (mirrors `payments`/`createCheckout`) ──

export interface PaymentsCreateCheckoutInput {
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
  idempotencyKey?: string
  successUrl?: string
  cancelUrl?: string
  customerEmail?: string
  currency?: string
  metadata?: Record<string, string>
}

export interface PaymentsCreateCheckoutResult {
  checkoutId: string
  checkoutUrl: string
  status: string
}
