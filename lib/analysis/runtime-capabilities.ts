/**
 * Atai Runtime capability vocabulary for the Collaborate workspace.
 *
 * Single source of truth for what the FINISHED application can consume from
 * Atai: the Runtime API capabilities and the @atai/sdk namespaces that wrap
 * them. The co-founder AI uses this block to ground integration advice in
 * what actually exists (spec section 50 — never invent capabilities), and to
 * keep the plan's Runtime & Integrations section aligned with the runtime
 * contract in `runtime/contracts/router.ts`.
 *
 * Kept as plain strings/constants — no server-only imports — so tests and
 * future client tooling can consume it too. Mirror of CAPABILITY_OPERATIONS;
 * descriptions are product language, not provider names (provider neutrality
 * is a runtime invariant — generated apps never learn which provider runs).
 */

export interface RuntimeCapabilitySummary {
  /** Capability ID on the wire (`capability` field of the Runtime request). */
  readonly capability: string
  /** SDK namespace on the Atai client (e.g. `atai.ai`). */
  readonly sdk: string
  /** Provider-neutral operations the capability exposes. */
  readonly operations: readonly string[]
  /** One-line, founder-friendly description of what it's for. */
  readonly description: string
  /** Founder-facing examples of features this capability powers. */
  readonly examples: readonly string[]
}

export const RUNTIME_CAPABILITY_SUMMARIES: readonly RuntimeCapabilitySummary[] = [
  {
    capability: "ai.text",
    sdk: "atai.ai",
    operations: ["chat", "completion", "embed"],
    description: "AI text generation — the app can think, write, and answer.",
    examples: ["support assistants", "content generation", "summarization", "smart replies"],
  },
  {
    capability: "ai.speak",
    sdk: "atai.voice",
    operations: ["synthesize"],
    description: "Text-to-speech — turn text into natural audio.",
    examples: ["voiceovers", "audio articles", "spoken notifications"],
  },
  {
    capability: "search.web",
    sdk: "atai.search",
    operations: ["web"],
    description: "Web search — query the open web for fresh results.",
    examples: ["research tools", "news feeds", "price checks"],
  },
  {
    capability: "web.scrape",
    sdk: "atai.web",
    operations: ["scrape"],
    description: "Scrape a public URL into clean markdown content.",
    examples: ["link previews", "article import", "catalog syncing"],
  },
  {
    capability: "email",
    sdk: "atai.email",
    operations: ["send"],
    description: "Transactional email — send messages to users.",
    examples: ["welcome emails", "receipts", "password resets", "digests"],
  },
  {
    capability: "sms",
    sdk: "atai.sms",
    operations: ["send"],
    description: "SMS messaging to phone numbers.",
    examples: ["verification codes", "order updates", "reminders"],
  },
  {
    capability: "whatsapp",
    sdk: "atai.whatsapp",
    operations: ["send"],
    description: "WhatsApp messaging.",
    examples: ["order updates", "support conversations", "promotions"],
  },
  {
    capability: "notifications",
    sdk: "atai.notifications",
    operations: ["send"],
    description: "Push notifications to a user's device.",
    examples: ["new-order alerts", "activity nudges", "announcements"],
  },
  {
    capability: "maps",
    sdk: "atai.maps",
    operations: ["geocode", "reverseGeocode"],
    description: "Geocoding — addresses to coordinates and back.",
    examples: ["location search", "delivery zones", "store locators"],
  },
  {
    capability: "calendar",
    sdk: "atai.calendar",
    operations: ["listBookings", "createBooking"],
    description: "Scheduling — list and create calendar bookings.",
    examples: ["appointment booking", "availability views", "reminders"],
  },
  {
    capability: "vectors",
    sdk: "atai.vectors",
    operations: ["upsert", "search", "delete"],
    description: "Vector storage — semantic search over embeddings.",
    examples: ["semantic search", "recommendations", "RAG knowledge bases"],
  },
  {
    capability: "db",
    sdk: "atai.db",
    operations: ["query", "create", "edit", "delete"],
    description: "The application's runtime database — records in, records out.",
    examples: ["saved user data", "order history", "app content"],
  },
  {
    capability: "payments",
    sdk: "atai.payments",
    operations: ["createCheckout"],
    description: "Checkout sessions — charge customers for products or plans.",
    examples: ["one-time purchases", "order checkout", "paid upgrades"],
  },
  {
    capability: "health",
    sdk: "atai.health",
    operations: ["check"],
    description: "Connectivity check — verify the runtime credential works.",
    examples: ["startup self-check", "status pages"],
  },
]

/**
 * Compact context block appended to every co-founder request (chat, analyze,
 * auto-complete). Deliberately terse — it ships on every AI call — but
 * complete enough that the AI never invents a capability Atai doesn't have.
 */
export const RUNTIME_AWARENESS_BLOCK = `ATAI RUNTIME CAPABILITIES (what the finished application can use):
Every application built from this plan talks to Atai through the official @atai/sdk with a project-scoped runtime API key (ATAI_API_KEY) that Atai provisions automatically — no provider accounts or provider keys are ever needed. Capabilities the plan names are wired into the generated app and billed as part of its runtime usage:
${RUNTIME_CAPABILITY_SUMMARIES.map((c) => `- ${c.capability} (${c.sdk}.${c.operations[0]}) — ${c.description} e.g. ${c.examples.slice(0, 2).join(", ")}.`).join("\n")}
End-user sign-in inside the generated app is handled by its built-in auth (Totalum SDK), not a runtime capability.
When the founder describes a feature that needs one of these capabilities, ground it in this exact vocabulary and reflect it in the "Runtime & Integrations" plan section — name the capabilities, what each is used for, and keep it in business language.`
