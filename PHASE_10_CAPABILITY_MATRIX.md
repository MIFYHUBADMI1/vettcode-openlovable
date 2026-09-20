# Phase 10 — Capability / Operation / Provider Matrix

## Existing Capabilities (from runtime/contracts/router.ts)

| Capability | Operations | Required Scope |
|------------|------------|----------------|
| ai.text | chat, completion, embed | ai.text |
| ai.embed | embed | ai.embed |
| ai.speak | synthesize | ai.speak |
| search.web | web | search.web |
| web.scrape | scrape | web.scrape |
| email | send | email |
| sms | send | sms |
| whatsapp | send | whatsapp |
| notifications | send | notifications |
| maps | geocode, reverseGeocode | maps |
| calendar | listBookings, createBooking | calendar |
| vectors | upsert, search, delete | vectors |
| db | query, create, edit, delete | db |
| payments | createCheckout | payments |
| test | echo | test |

## Phase 10 Provider Mapping

| Provider | Capability | Operation | Scope | Provider Cost Available? | Side Effect? | Status |
|----------|------------|-----------|-------|--------------------------|--------------|--------|
| OpenRouter | ai.text | chat | ai.text | Yes (tokens/cost) | No | Implemented |
| ElevenLabs | ai.speak | synthesize | ai.speak | Yes (characters) | No | Implemented |
| Firecrawl | search.web | web | search.web | Yes (credits/pages) | No | Implemented |
| Firecrawl | web.scrape | scrape | web.scrape | Yes (credits/pages) | No | Implemented |
| Resend | email | send | email | Yes (messages) | Yes | Implemented |
| Twilio | sms | send | sms | Yes (segments) | Yes | Implemented |
| Twilio | whatsapp | send | whatsapp | Yes (messages) | Yes | Implemented |
| Firebase | notifications | send | notifications | No | Yes | Implemented |
| Mapbox | maps | geocode | maps | Yes (requests) | No | Implemented |
| Mapbox | maps | reverseGeocode | maps | Yes (requests) | No | Implemented |
| Cal.com | calendar | listBookings | calendar | No | No | Implemented |
| Cal.com | calendar | createBooking | calendar | No | Yes | Implemented |
| Cloudflare | vectors | upsert | vectors | No | Yes | Implemented |
| Cloudflare | vectors | search | vectors | No | No | Implemented |
| Cloudflare | vectors | delete | vectors | No | Yes | Implemented |
| Totalum | db | query | db | No | No | Implemented |
| Totalum | db | create | db | No | Yes | Implemented |
| Totalum | db | edit | db | No | Yes | Implemented |
| Totalum | db | delete | db | No | Yes | Implemented |
| Dodo | payments | createCheckout | payments | Yes (transactions) | Yes | Implemented |

## Provider Registration Order

1. openrouter (existing)
2. elevenlabs (new)
3. firecrawl (new)
4. resend (new)
5. twilio (new)
6. firebase (new)
7. mapbox (new)
8. calcom (new)
9. cloudflare (new)
10. totalum (new)
11. dodo (new)

## Environment Variables Required

| Provider | Required Environment Variables |
|----------|--------------------------------|
| OpenRouter | OPENROUTER_API_KEY |
| ElevenLabs | ELEVENLABS_API_KEY |
| Firecrawl | FIRECRAWL_API_KEY |
| Resend | RESEND_API_KEY |
| Twilio | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER |
| Firebase | FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL |
| Mapbox | MAPBOX_ACCESS_TOKEN |
| Cal.com | CALCOM_API_KEY |
| Cloudflare | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_VECTORIZE_INDEX_ID |
| Totalum | TOTALUM_API_KEY |
| Dodo | DODO_API_KEY |

## Security Requirements

1. All provider credentials remain server-side only
2. Generated apps only receive Atai runtime API key
3. Provider credentials never exposed in:
   - SDK
   - Browser JavaScript
   - API responses
   - Runtime logs
   - Admin UI
   - Error messages
   - Usage records

4. Project/environment isolation enforced
5. Scope-based authorization for each capability
6. SSRF protection for URL-based operations (Firecrawl)
7. Input validation for all operations
8. Rate limiting respected from both Atai and provider
9. Idempotency keys for side-effect operations where supported

## Billing Integration

- All operations use Phase 9.5 pricing system
- Pricing resolved BEFORE provider execution
- Credits checked/reserved before provider call
- Usage recorded with provider cost metadata
- Admin can configure pricing per operation
- Historical pricing preserved (not recalculated)
