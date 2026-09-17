# 🔑 Key Features Reference

**Every major feature explained — what it does, how it works, where the code is**

---

## 1. Smart Crawl

**What it is**: Quick website analysis — maps the site, picks the 7 most important pages, scrapes them.

**User experience**: Enter URL → pay 10 credits → get screenshots + analysis in ~30 seconds.

**How it works internally**:
```
1. normalizeUrl(inputUrl)          → clean, canonical URL
2. getCachedEvidence(url, "smart") → return cached if <7 days old
3. firecrawl /v2/map               → discover all pages on the site
4. selectRelevantPages(root, pages, 7) → score and pick top 7
5. firecrawl /v2/scrape (×7)       → scrape each selected page
6. combine into WebsiteEvidence    → pages[], screenshots[], assets[]
7. setCachedEvidence(url, "smart") → save to MongoDB cache
8. return evidence
```

**Page scoring algorithm** (`lib/integrations/firecrawl/service.ts` → `scorePageUrl()`):
- `/pricing` → +10 points (highest value for understanding the product)
- `/features`, `/product` → +8 points
- `/about`, `/home`, `/index` → +6 points
- `/docs`, `/help`, `/faq` → +4 points
- `/blog`, `/news` → +2 points
- Deeply nested paths (4+ segments) → -5 points
- UUID-looking paths (random strings) → -8 points
- Root `/` → +5 points

This ensures you get the pages that tell you what the product IS, not random blog posts.

**Cost**: 5 credits (scrape) + 5 credits (plan) = **10 credits total**  
**Files**: `lib/integrations/firecrawl/service.ts` → `crawlWebsite()`

---

## 2. Deep Crawl

**What it is**: Full site recursive crawl — every page, up to 50 pages, 15-minute timeout.

**User experience**: Enter URL → pay 500-1000 credits → thorough analysis of entire site.

**How it works internally**:
```
1. normalizeUrl(inputUrl)
2. getCachedEvidence(url, "deep") → return cached if <7 days old
3. firecrawl /v2/crawl (async)   → start deep recursive crawl
4. poll for completion            → every 30 seconds, up to 30 polls (15 min)
5. if pages < 5 → supplementWithWebSearch() → add web search results
6. combine all evidence
7. setCachedEvidence(url, "deep")
8. return evidence
```

**Modes**:
- `legacy` (500 credits): Crawl only. Standard AI analysis after.
- `heavy` (1000 credits): Crawl + full 7-stage AI pipeline. Better quality.

**Blocked site handling**: If a site like Netflix blocks crawlers, the crawl returns 0-1 pages. Rather than failing, the system automatically runs 4 web searches:
- `"Netflix features"`
- `"Netflix about"`
- `"Netflix help"`
- `"what is Netflix"`

These results get merged with the crawl data and marked `metadata.fromWebSearch: true`.

**Files**: `lib/integrations/firecrawl/service.ts` → `crawlWebsiteDeep()`, `supplementWithWebSearch()`

---

## 3. ApplicationSpecification

**What it is**: The structured output from AI analysis. This is the core data product — everything else (code generation, UI display) is derived from it.

**Why it matters**: This is what gets turned into actual code. The quality of the spec directly determines the quality of the generated website.

**Structure**:
```typescript
interface ApplicationSpecification {
  title: string               // App name (e.g., "Spotify Clone")
  description: string         // One paragraph about the app
  complexity: "simple" | "medium" | "complex"
  
  // Pages of the application
  pages: {
    name: string              // "Landing Page", "Dashboard", etc.
    path: string              // "/", "/dashboard", etc.
    purpose: string           // What this page does
    components: string[]      // Components used on this page
    isProtected: boolean      // Requires login?
  }[]
  
  // Reusable UI components
  components: {
    name: string              // "NavBar", "PricingCard", etc.
    type: string              // "navigation" | "card" | "form" | etc.
    description: string
    props: string[]           // Props this component accepts
  }[]
  
  // Design system
  designSystem: {
    colors: { primary, secondary, accent, background, text... }
    typography: { fontFamily, headingSize, bodySize... }
    spacing: string           // "4px base unit" etc.
  }
  
  // Data layer
  dataEntities: {
    name: string              // "User", "Product", "Order"
    fields: string[]          // Field names and types
    relationships: string[]   // "User has many Orders"
  }[]
  
  // User journeys
  coreFlows: {
    name: string              // "User Signup", "Checkout"
    steps: string[]           // Step-by-step description
  }[]
  
  // API surface
  apiEndpoints: {
    method: string            // GET, POST, etc.
    path: string              // /api/users
    description: string
    auth: boolean
  }[]
  
  // Feature flags
  suggestedFeatures: {
    name: string
    description: string
    enabled: boolean          // Pre-selected features
    priority: "high" | "medium" | "low"
  }[]
  
  integrations: string[]      // ["Stripe", "Sendgrid", etc.]
  backendRequirements: string[]
  
  // Set by complexity classifier
  complexity: "simple" | "medium" | "complex"
}
```

**Where it's stored**: In the `projects` MongoDB collection as `project.specification`.

**Where it's used**: 
- UI: Displays to user after analysis
- Build: Will be used to generate code (TO BE IMPLEMENTED)
- Credits: Complexity drives build cost

---

## 4. Credit System

See `CREDIT_SYSTEM.md` for full details. Key points:

- Credits are the internal currency
- Subscription credits expire monthly, permanent credits never expire
- Every operation reserves before executing, refunds on failure
- Full audit trail in `credit_ledger` collection
- No race conditions (atomic reservation)

---

## 5. Dodo Payments Integration

**What it is**: The payment processor for Atai. Handles subscriptions and one-time credit purchases.

> ⚠️ **NOT Stripe** — despite docs that say "Stripe". The actual payment provider is **Dodo Payments** (`dodopayments` npm package). This was migrated from Stripe. Update any docs that say Stripe.

**Subscription plans**:
```
Explorer     → DODO_PRODUCT_EXPLORER
Starter      → DODO_PRODUCT_STARTER
Business     → DODO_PRODUCT_BUSINESS
Professional → DODO_PRODUCT_PROFESSIONAL
Enterprise   → DODO_PRODUCT_ENTERPRISE
```

**Credit packs** (permanent credits):
```
200K credits  → DODO_PRODUCT_PERM_200K
500K credits  → DODO_PRODUCT_PERM_500K
1M credits    → DODO_PRODUCT_PERM_1M
5M credits    → DODO_PRODUCT_PERM_5M
15M credits   → DODO_PRODUCT_PERM_15M
```

**Webhook flow**:
1. User pays on Dodo checkout
2. Dodo sends webhook to `POST /api/billing/webhook`
3. Webhook verified with `DODO_PAYMENTS_WEBHOOK_KEY`
4. Payment record created in `payment_records`
5. Credits granted to user
6. Ledger entry created

**Test mode**: `DODO_PAYMENTS_ENVIRONMENT=test_mode` in `.env.local`. Switch to `live_mode` at launch.

**Files**: `lib/billing/`, `app/api/billing/`

---

## 6. AI Models (OpenRouter)

**What it is**: All AI calls go through OpenRouter — a single API that routes to multiple AI providers (Nvidia, Google, Cohere, Poolside, etc.).

**Why OpenRouter?**: One API key for many models. Easy to switch models. Free tier models available for development.

**Configured models** (from `.env.local`):
```
IDEA_UNDERSTANDING_MODEL=nvidia/nemotron-3-super-120b-a12b:free
RESEARCH_MODEL=poolside/laguna-s-2.1:free
PLANNER_MODEL=nvidia/nemotron-3-super-120b-a12b:free
CRITIC_MODEL=nvidia/nemotron-3-super-120b-a12b:free
REPAIR_MODEL=poolside/laguna-s-2.1:free
```

**Free model caveat**: Free models are sometimes unreliable (slow, rate limited, bad quality). The pipeline is built to handle this (fallbacks, non-blocking stages). For production with paying users, switch to paid models.

**Fallback models**: Each stage has a `*_FALLBACK_MODEL` env var. If primary model fails, fallback is used automatically.

**Files**: `lib/integrations/openrouter/`, `lib/planning/stages/*.ts`

---

## 7. Project State Machine

Every project moves through states. Understanding this is important for debugging.

```
[created]
    ↓ (analysis starts)
[analyzing]
    ↓ (crawl complete)
[analysis_complete]
    ↓ (spec generated)
[specification_ready]
    ↓ (build started)
[building]
    ↓ (build complete)
[deployed]

At any point → [build_failed] (with error message)
```

**Where state is stored**: `projects.state` in MongoDB

**How to check state**: 
- User polls `GET /api/projects/{id}/status` every 2 seconds
- Returns `{ state, events[] }` for live updates
- Events are the activity timeline shown in UI

**How to reset stuck projects** (admin):
- Go to `/admin/infrastructure`
- Find the project
- Reset state manually

---

## 8. ImageKit

**What it is**: CDN for storing and serving project screenshots and assets.

**Configured**: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` in `.env.local`

**Used for**: Storing screenshots taken during crawls so they load fast in the UI without serving them directly from MongoDB.

**Files**: Any file importing from `imagekit` npm package

---

## 9. Google OAuth

**What it is**: "Login with Google" button.

**Configured**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env.local`

**Flow**:
1. User clicks "Login with Google"
2. Redirects to Google consent screen
3. Google redirects back to `/api/auth/google/callback`
4. System finds or creates user with `googleId`
5. Session created, user logged in

**Local dev note**: `OAUTH_BASE_URL=http://localhost:3000` must be set for OAuth to redirect correctly in local dev. Production uses `NEXT_PUBLIC_APP_URL`.

**Files**: `app/api/auth/google/`

---

## 10. Rate Limiting

**What it is**: Prevents abuse — limits how many requests a user/IP can make in a time window.

**Applied to**: Auth endpoints (login, register), analysis start, credits API.

**Storage**: MongoDB `rate_limits` collection (TTL-based reset).

**How to adjust limits**: Search for `rateLimitsCol()` usage in `app/api/` files.

---

## 11. Planning Run Logs

**What it is**: Every execution of the 7-stage AI pipeline is logged with full stage-by-stage output.

**Why useful**: When a user reports "my analysis failed", you can look up the `planning_run` for their project and see exactly which stage failed and what the AI returned.

**Where to view**: Admin panel → `/admin/infrastructure` → click a project → view planning runs

**Retention**: Auto-deleted after 90 days (TTL index in MongoDB)

**Files**: `lib/planning/tracking/planning-run.ts`

---

## 12. Vercel Analytics

**What it is**: Built-in Vercel analytics for tracking page views and performance.

**Configured**: `VERCEL_WEB_ANALYTICS_ID` in `.env.local`

**Note**: This is basic analytics. For user behavior tracking (who clicked what, funnel analysis), you'll need PostHog or Mixpanel (not yet implemented — see `NEXT_STEPS.md`).

---

## Tech Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16.3 (App Router) | Full-stack, Vercel-native |
| Language | TypeScript 5.7 | Type safety |
| Database | MongoDB 7 | Flexible schema, cloud Atlas |
| Styling | Tailwind CSS 4 | Utility-first, fast |
| UI Components | shadcn/ui + Base UI | Accessible, composable |
| Auth | Custom JWT (jose) | Full control, no vendor lock-in |
| Payments | Dodo Payments | Modern Stripe alternative |
| Crawling | Firecrawl | Best web crawling API |
| AI | OpenRouter + AI SDK | Multi-model, provider-agnostic |
| Email | Nodemailer + Gmail SMTP | Simple, reliable |
| Validation | Zod 4 | Schema validation |
| Testing | Vitest | Fast, TypeScript-native |
| Deployment | Vercel | Zero-config Next.js hosting |
| CDN | ImageKit | Image storage + optimization |
| Analytics | Vercel Analytics | Built-in performance |

---

## Environment Variables Quick Reference

All in `.env.local`:

```bash
# App
NEXT_PUBLIC_APP_URL         # Production URL: https://Atai.atai.ink
AUTH_SECRET                 # JWT signing secret (random, keep secret)

# Database
MONGODB_URI                 # MongoDB Atlas connection string

# Crawling
FIRECRAWL_API_KEY           # Firecrawl API key

# AI
OPENROUTER_API_KEY          # OpenRouter API key
OPENROUTER_MODEL            # Default model
# Per-stage models (see .env.local for full list)

# Payments
DODO_PAYMENTS_API_KEY       # Dodo Payments API key
DODO_PAYMENTS_WEBHOOK_KEY   # Dodo webhook verification secret
DODO_PAYMENTS_ENVIRONMENT   # "test_mode" or "live_mode"
DODO_PRODUCT_*              # Product IDs (pre-created)

# Auth
GOOGLE_CLIENT_ID            # Google OAuth client ID
GOOGLE_CLIENT_SECRET        # Google OAuth secret
OAUTH_BASE_URL              # For local dev: http://localhost:3000

# Email
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM

# CDN
IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT
```

---

**Related**: `AI_PIPELINE.md` for pipeline details, `CREDIT_SYSTEM.md` for billing, `DATABASE_SCHEMA.md` for data models
