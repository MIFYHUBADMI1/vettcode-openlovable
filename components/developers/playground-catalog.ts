/**
 * Developer playground — static catalogue.
 *
 * Labels, grouping, sample inputs and request-shape hints for the runtime
 * capability registry. Pure data + tiny helpers: no React, no fetching.
 * Operations themselves stay server-authoritative (GET /api/runtime/v1);
 * this module only names and illustrates them.
 *
 * @module components/developers/playground-catalog
 */

export const RECOMMENDED_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"

/**
 * Image-capable model for the ai.vision sample. The text-only recommended
 * default is rejected by the provider for image input ("no endpoints found
 * that support image input"), so vision needs its own prefilled model.
 * Mirrors RECOMMENDED_VISION_MODEL in the server-only OpenRouter mapper.
 */
export const RECOMMENDED_VISION_MODEL = "nvidia/nemotron-3.5-super-vl:free"

/**
 * Working TTS route (verified live 2026-10-26). Mirrors the server-only
 * defaults in the OpenRouter multimodal mapper — this model needs an explicit
 * voice, and returns MP3. The previous sample used a model id that does not
 * exist on OpenRouter, which surfaced as a 502.
 */
export const RECOMMENDED_SPEECH_MODEL = "mistralai/voxtral-mini-tts-2603"
export const RECOMMENDED_SPEECH_VOICE = "en_paul_neutral"

/** Live video route; `google/veo-3` is not in the current model catalogue. */
export const RECOMMENDED_VIDEO_MODEL = "google/veo-3.1-fast"

/**
 * The platform Cal.com account's "15 min meeting" event type (id 7618341,
 * owner mixify-hub-sifk0n). The createBooking sample prefills this so the
 * example works out of the box — without it AND without
 * CALCOM_DEFAULT_EVENT_TYPE_ID the mapper rejects the call with a 422.
 * Discover current ids via the Cal.com console: GET /v2/event-types with
 * cal-api-version 2026-06-12.
 */
export const RECOMMENDED_CALCOM_EVENT_TYPE_ID = 7618341

/**
 * 1x1 red PNG. A data URI is used instead of a hosted URL because the provider
 * rejects image URLs it cannot resolve (example.com/photo.jpg returns a 404),
 * and the playground sample has to work as soon as it is sent.
 */
const SAMPLE_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

/** Registry snapshot used only until GET /api/runtime/v1 resolves. */
export const FALLBACK_CAPABILITY_OPERATIONS: Record<string, readonly string[]> = {
  "ai.text": ["chat", "completion", "embed"],
  "ai.embed": ["embed"],
  "ai.speak": ["synthesize"],
  "ai.image": ["generateImage"],
  "ai.video": ["generateVideo"],
  "ai.speech": ["speak"],
  "ai.transcribe": ["transcribe"],
  "ai.vision": ["visionInput"],
  "search.web": ["web"],
  "web.scrape": ["scrape"],
  email: ["send"],
  notifications: ["send"],
  maps: [
    "geocode",
    "reverseGeocode",
    "search",
    "placeDetails",
    "isochrone",
    "directions",
    "matrix",
    "tilesMetadata",
    "styleSchema",
    "staticImage",
  ],
  calendar: ["listBookings", "createBooking"],
  vectors: ["upsert", "search", "delete"],
  db: ["query", "create", "edit", "delete"],
  payments: ["createCheckout", "createSubscription", "listPayments", "listPayouts"],
}

export const CAPABILITY_LABELS: Record<string, string> = {
  "ai.text": "Text & chat",
  "ai.embed": "Embeddings",
  "ai.speak": "Voice (ElevenLabs)",
  "ai.image": "Image generation",
  "ai.video": "Video generation",
  "ai.speech": "Text-to-speech",
  "ai.transcribe": "Transcription",
  "ai.vision": "Vision input",
  "search.web": "Web search",
  "web.scrape": "Web scraping",
  email: "Email",
  notifications: "Realtime notifications",
  maps: "Maps (Mapbox)",
  calendar: "Scheduling (Cal.com)",
  vectors: "Vector storage",
  db: "App database",
  payments: "Payments",
}

export const OPERATION_LABELS: Record<string, string> = {
  chat: "Chat",
  completion: "Completion",
  embed: "Embed",
  synthesize: "Synthesize",
  generateImage: "Generate image",
  generateVideo: "Generate video",
  speak: "Speak",
  transcribe: "Transcribe",
  visionInput: "Vision input",
  web: "Web search",
  scrape: "Scrape",
  send: "Send",
  geocode: "Geocode",
  reverseGeocode: "Reverse geocode",
  // `search` is an operation under BOTH maps and vectors — resolve the
  // `${capability}/${operation}` key first, so vectors keeps the plain label.
  "maps/search": "Search box",
  placeDetails: "Place details",
  isochrone: "Isochrone",
  directions: "Directions",
  matrix: "Travel matrix",
  tilesMetadata: "Tile reachability",
  styleSchema: "Style schema",
  staticImage: "Static image",
  listBookings: "List bookings",
  createBooking: "Create booking",
  upsert: "Upsert",
  search: "Search",
  delete: "Delete",
  query: "Query",
  create: "Create",
  edit: "Edit",
  createCheckout: "Create checkout",
  createSubscription: "Create subscription",
  listPayments: "List payments",
  listPayouts: "List payouts",
}

/** Rail grouping. Capabilities the server reports that aren't listed land in "More". */
export const CAPABILITY_GROUPS: { id: string; label: string; members: readonly string[] }[] = [
  {
    id: "ai",
    label: "Intelligence",
    members: ["ai.text", "ai.embed", "ai.speak", "ai.image", "ai.video", "ai.speech", "ai.transcribe", "ai.vision"],
  },
  { id: "web", label: "Web", members: ["search.web", "web.scrape"] },
  { id: "comms", label: "Messaging", members: ["email", "notifications"] },
  { id: "geo", label: "Location", members: ["maps", "calendar"] },
  { id: "data", label: "Data", members: ["vectors", "db"] },
  { id: "commerce", label: "Commerce", members: ["payments"] },
]

/**
 * Capabilities whose model must be set inside the input JSON.
 *
 * ai.transcribe is deliberately NOT here: its model is pinned server-side
 * (openai/whisper-large-v3-turbo) and the provider rejects any caller-supplied
 * model, so requiring a "model" field in the body would block every request.
 */
export const MEDIA_MODEL_CAPABILITIES = new Set(["ai.image", "ai.video", "ai.speech", "ai.vision"])

const DEMO_EMAIL = "you@example.com"
const DEMO_SUCCESS_URL = "https://example.com/success"
const DEMO_CANCEL_URL = "https://example.com/cancel"

function futureDateIso(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 19) + "Z"
}

/**
 * Deterministic pseudo-embedding matching the deployment's Vectorize index
 * (768 dims — bge-base-en-v1.5). Real pipelines should pipe ai.embed output
 * straight in; this keeps the vectors samples valid without an embed round-trip.
 */
function demoVector(dim: number, seed: number): number[] {
  return Array.from({ length: dim }, (_, i) => Math.sin(seed + i * 0.37) * 0.1)
}

const j = (value: unknown): string => JSON.stringify(value, null, 2)

/** Prefill bodies keyed by `capability/operation`. */
export function sampleInputs(): Record<string, string> {
  return {
    "ai.text/chat": j({ messages: [{ role: "user", content: "Say hello in one short sentence." }] }),
    "ai.text/completion": j({ prompt: "Explain quantum computing in one short sentence." }),
    "ai.text/embed": j({ input: "hello world" }),
    "ai.embed/embed": j({ input: "hello world" }),
    "ai.speak/synthesize": j({ text: "Hello from Atai!", model: "eleven_flash_v2_5" }),
    "ai.image/generateImage": j({
      prompt: "A red panda astronaut floating in space",
      model: "google/gemini-2.5-flash-image",
      aspect_ratio: "16:9",
    }),
    "ai.video/generateVideo": j({
      prompt: "A timelapse of a city skyline at dusk",
      model: RECOMMENDED_VIDEO_MODEL,
      duration: 5,
    }),
    "ai.speech/speak": j({
      input: "Hello from Atai!",
      model: RECOMMENDED_SPEECH_MODEL,
      voice: RECOMMENDED_SPEECH_VOICE,
      response_format: "mp3",
    }),
    "ai.transcribe/transcribe": j({
      input_audio: { data: "<base64 audio>", format: "wav" },
    }),
    "ai.vision/visionInput": j({
      model: RECOMMENDED_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What colour is this image? Answer in one word." },
            { type: "image_url", image_url: { url: SAMPLE_IMAGE_DATA_URL } },
          ],
        },
      ],
      // Reasoning models spend part of the budget before answering; a tight
      // default returns finish_reason "length" with no visible content.
      max_tokens: 1024,
    }),
    "search.web/web": j({ query: "best coffee in Kampala", limit: 3 }),
    "web.scrape/scrape": j({ url: "https://example.com" }),
    "email/send": j({
      to: [DEMO_EMAIL],
      subject: "Hello from Atai",
      text: "This email was delivered through the Atai runtime.",
    }),
    "notifications/send": j({
      channel: "orders",
      event: "new-order",
      title: "Hello from Atai",
      body: "This notification was broadcast through the runtime.",
      data: { table: 4 },
    }),
    "maps/geocode": j({ query: "Kampala", limit: 3 }),
    "maps/reverseGeocode": j({ longitude: 32.5828, latitude: 0.3136, limit: 1 }),
    "maps/search": j({ query: "coffee shops in Kampala", limit: 5, longitude: 32.5828, latitude: 0.3136 }),
    // Kampala's own Mapbox place id — sends as-is. Copy results[].id from a
    // maps/search or maps/geocode run to look up anything else.
    "maps/placeDetails": j({ poiId: "dXJuOm1ieHBsYzpFUVRx" }),
    "maps/isochrone": j({ coordinates: [32.5828, 0.3136], profile: "driving", minutes: [10, 20, 30] }),
    "maps/directions": j({
      coordinates: [
        [32.5828, 0.3136],
        [32.5729, 0.3476],
      ],
      profile: "driving",
    }),
    "maps/matrix": j({
      coordinates: [
        [32.5828, 0.3136],
        [32.5729, 0.3476],
        [32.6005, 0.3002],
      ],
      profile: "driving",
      annotations: ["duration", "distance"],
    }),
    // A tileset id (mapbox.mapbox-streets-v8), NOT a style id.
    "maps/tilesMetadata": j({ tilesetId: "mapbox.mapbox-streets-v8", z: 12, x: 2292, y: 1836 }),
    "maps/styleSchema": j({ username: "mapbox", styleId: "streets-v12" }),
    // One overlay per image (Mapbox limit): `marker:true` pins the centre, or
    // `path:[[lng,lat],…]` draws a polyline and `fit:true` frames it.
    "maps/staticImage": j({ longitude: 32.5828, latitude: 0.3136, zoom: 12, width: 800, height: 500, marker: true, retina: true }),
    "calendar/listBookings": j({ limit: 10, status: "upcoming" }),
    "calendar/createBooking": j({
      start: futureDateIso(),
      eventTypeId: RECOMMENDED_CALCOM_EVENT_TYPE_ID,
      attendee: { name: "Ada Tester", email: DEMO_EMAIL, timeZone: "Africa/Kampala" },
    }),
    "vectors/upsert": j({ vectors: [{ id: "doc-1", values: demoVector(768, 1), metadata: { kind: "demo" } }] }),
    "vectors/search": j({ vector: demoVector(768, 1), topK: 3, returnMetadata: "indexed" }),
    "vectors/delete": j({ ids: ["doc-1"] }),
    "db/query": j({ tableName: "customers", limit: 5 }),
    "db/create": j({ tableName: "customers", data: { name: "Ada Tester", email: DEMO_EMAIL } }),
    "db/edit": j({ tableName: "customers", recordId: "<record id>", data: { name: "Ada Tester (edited)" } }),
    "db/delete": j({ tableName: "customers", recordId: "<record id>" }),
    "payments/createCheckout": j({
      items: [{ productId: "pdt_0NmxWCnTidDQjIl0YqkqV", name: "Explorer Plan", quantity: 1 }],
      idempotencyKey: `demo-checkout-${Date.now()}`,
      successUrl: DEMO_SUCCESS_URL,
      customerEmail: DEMO_EMAIL,
      currency: "USD",
    }),
    "payments/createSubscription": j({
      productId: "prdtxxxxxxxxxxxx",
      quantity: 1,
      customer: { email: DEMO_EMAIL, name: "Ada Tester" },
      billing: { country: "US", city: "Kampala" },
      returnUrl: DEMO_SUCCESS_URL,
    }),
    "payments/listPayments": j({ limit: 20, status: "succeeded" }),
    "payments/listPayouts": j({ limit: 10 }),
  }
}

/** One-line field guidance per `capability/operation`. */
export const REQUEST_HINTS: Record<string, string> = {
  "ai.text/chat": "messages[] with role/content. Model comes from the Model control.",
  "ai.text/completion": "A single-shot prompt; optional temperature/max_tokens/stop. Model comes from the Model control.",
  "ai.text/embed": "input (string or string[]) → embeddings. Override the model server-side with CLOUDFLARE_EMBEDDING_MODEL.",
  "ai.embed/embed": "input (string or string[]) → { embeddings, model, dimensions }.",
  "ai.speak/synthesize": "text (1–5,000 chars). Optional voiceId/model from the ElevenLabs allowlist. Returns base64 MP3 — the response panel plays and downloads it, and atai.voice.toDataUrl() makes it usable in your app.",
  "ai.image/generateImage": "prompt plus an optional image-capable model (defaults server-side). Returns images[] as base64 + mediaType; aspect_ratio/n/resolution optional.",
  "ai.video/generateVideo": "prompt + optional model (defaults server-side). Returns { jobId, status } — poll the same operation with { jobId }.",
  "ai.speech/speak":
    "input text (≤10,000 chars) + optional TTS model, voice and response_format (mp3 | pcm). Unmodelled calls use a working server default with an explicit voice. Returns audioBase64 + mimeType/model/bytes; PCM clips include rate= and channels= so they can be wrapped for playback.",
  "ai.transcribe/transcribe":
    "input_audio { data (base64 of real speech), format (wav/mp3/flac/…) } — replace the placeholder with actual audio; optional language hint. No model field: openai/whisper-large-v3-turbo is pinned server-side and any other model is rejected. Runs through OpenRouter's /audio/transcriptions endpoint.",
  "ai.vision/visionInput":
    "messages[] mixing text parts and image_url parts. The model must accept image input, and image_url.url must be a publicly reachable image or a data:image/…;base64 URI — the sample uses a 1x1 PNG so it works without hosting anything.",
  "search.web/web": "query plus optional limit. Results normalize to title/url/snippet items.",
  "web.scrape/scrape": "url to fetch and return as markdown/text.",
  "email/send": "to[] + subject + text and/or html. The platform sender is injected server-side — never send a from.",
  "notifications/send": "channel (the Realtime topic your app subscribes to), optional event (default notification), title and body; optional data object and private:true. The topic is scoped to your project automatically.",
  "maps/geocode": "query plus optional limit (≤5), country (ISO 3166) and language tags.",
  "maps/reverseGeocode": "longitude (−180..180) and latitude (−90..90); optional limit.",
  "maps/search": "Search Box: query, limit (≤10), optional longitude+latitude proximity bias, types[], bbox, country, language.",
  "maps/placeDetails": "poiId — a Mapbox feature id (results[].id from search/geocode). A Search Box session token is minted server-side; optional language.",
  "maps/isochrone": "coordinates [lng, lat], profile (driving|walking|cycling), minutes[] (1..240, ≤6).",
  "maps/directions": "coordinates — 2..6 ordered [lng, lat] pairs; profile incl. driving-traffic. Routes carry GeoJSON geometry for map drawing.",
  "maps/matrix": "coordinates — 2..5 [lng, lat] pairs; profile (driving|walking); annotations[] (duration|distance). Matrices return under payload.",
  "maps/tilesMetadata": "tilesetId + z/x/y (0 ≤ x,y < 2^z) — a Mapbox TILESET id such as mapbox.mapbox-streets-v8, not a style id. Proves the key reaches the tile endpoint.",
  "maps/styleSchema": "username + styleId — returns the full style JSON (layers, sources, glyphs, sprite).",
  "maps/staticImage": "longitude/latitude/zoom + width/height (≤1280). One overlay only: marker:true pins the centre, or path[[lng,lat]…]+pathWidth/pathColor draws a polyline (fit:true frames it). retina:true renders 2x. Shows inline.",
  "calendar/listBookings": "Read-only. Optional limit (≤50) and status (upcoming | past | cancelled).",
  "calendar/createBooking":
    "Real side effect — books in the platform Cal.com account. start must be a future ISO timestamp. eventTypeId is prefilled with a working platform event type (or falls back to CALCOM_DEFAULT_EVENT_TYPE_ID); list current ids via the Cal.com console (GET /v2/event-types, cal-api-version 2026-06-12). Cal.com rejects placeholder domains like example.com — put a real attendee email in or the provider returns 400.",
  "vectors/upsert": "vectors[] of { id, values } — values length must equal the index dimensions (768 for this deployment; CLOUDFLARE_EMBEDDING_MODEL has no vector source of its own, so pipe ai.embed output straight in). Namespace comes from your project.",
  "vectors/search": "vector to query with, optional topK and returnMetadata (none | indexed | all). Vectorize is eventually consistent — a vector you just upserted may not match for up to ~2 minutes.",
  "vectors/delete": "ids[] of vector ids to remove from your project's namespace.",
  "db/query": "Your project's database (Totalum). tableName + optional filter/limit/skip/sortBy/sortDirection.",
  "db/create": "tableName + a data object — writes a new record to your project's database.",
  "db/edit": "tableName, recordId, and a data object of fields to update.",
  "db/delete": "tableName + recordId — permanently removes the record.",
  "payments/createCheckout":
    "Dodo bills catalog products only: each item needs a productId (pdt_… — the sample uses the test-mode Explorer product; list yours with the SDK or dashboard). price/name are informational; the charged amount comes from the product. → hosted checkoutUrl (test mode by default).",
  "payments/createSubscription": "Real recurring charge: productId, quantity, customer {email,name}, billing {country}.",
  "payments/listPayments": "Read-only payment feed. Optional limit (≤100), status, subscriptionId or customerId.",
  "payments/listPayouts": "Read-only, account-level settlements of the platform merchant account.",
}

/** Operations that actually cost money — surfaced so the sender isn't a surprise. */
export const SIDE_EFFECT_OPERATIONS = new Set([
  "email/send",
  "notifications/send",
  "calendar/createBooking",
  "payments/createCheckout",
  "payments/createSubscription",
  "db/create",
  "db/edit",
  "db/delete",
  "vectors/upsert",
  "vectors/delete",
])
