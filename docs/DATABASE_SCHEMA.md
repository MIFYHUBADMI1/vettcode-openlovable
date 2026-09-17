# 🗄️ Database Schema

**Complete MongoDB Collection Reference**

---

## Overview

Atai uses **MongoDB Atlas** (cloud-hosted) for all data storage.

### Database Name
`Ataiai` (configured in `.env.local`)

### Total Collections
**15 collections** covering users, projects, billing, and system data

### Retention Policies
- **User data**: Permanent (unless user deletes account)
- **Projects**: Permanent
- **Credit ledger**: Permanent (audit trail)
- **Planning runs**: 90 days (auto-deleted via TTL index)
- **Firecrawl cache**: 7 days (auto-deleted via TTL index)
- **Sessions**: 30 days (auto-deleted via TTL index)
- **Verification tokens**: 24 hours (auto-deleted via TTL index)

---

## Core Collections

### 1. `users`
**Purpose**: User accounts and credit balances

```typescript
interface UserDoc {
  _id: ObjectId
  email: string                    // Unique email address
  emailVerified: boolean           // Email verification status
  passwordHash?: string            // bcrypt hash (if email/password auth)
  googleId?: string                // Google OAuth ID (if Google auth)
  name?: string                    // Display name
  image?: string                   // Profile picture URL
  role: "user" | "admin"           // Authorization level
  
  // Credit system
  credits: number                  // Total available credits
  creditBuckets: CreditBucket[]    // Individual credit grants
  
  // Referral system
  referralCode: string             // Unique referral code
  referredBy?: string              // Referrer's user ID
  
  // Metadata
  createdAt: number                // Timestamp
  updatedAt: number                // Timestamp
  deletedAt?: number               // Soft delete timestamp
}

interface CreditBucket {
  id: string                       // Unique bucket ID
  amount: number                   // Credits in this bucket
  creditType: "subscription" | "permanent"
  expiresAt?: number               // Expiration (subscription only)
  subscriptionId?: string          // Stripe subscription ID
  grantedAt: number                // When credits were granted
  source: string                   // "signup" | "purchase" | "referral" | "admin"
}
```

**Indexes**:
- `{ email: 1 }` - unique
- `{ googleId: 1 }` - unique, sparse
- `{ referralCode: 1 }` - sparse
- `{ creditBuckets.subscriptionId: 1 }` - sparse
- `{ creditBuckets.expiresAt: 1 }` - sparse
- `{ deletedAt: 1, credits: -1 }` - for admin "top users" query

**Example**:
```json
{
  "_id": ObjectId("..."),
  "email": "user@example.com",
  "emailVerified": true,
  "passwordHash": "$2b$10$...",
  "name": "John Doe",
  "role": "user",
  "credits": 5500,
  "creditBuckets": [
    {
      "id": "bucket_abc123",
      "amount": 500,
      "creditType": "subscription",
      "expiresAt": 1704067200000,
      "subscriptionId": "sub_xyz789",
      "grantedAt": 1701388800000,
      "source": "subscription"
    },
    {
      "id": "bucket_def456",
      "amount": 5000,
      "creditType": "permanent",
      "grantedAt": 1701388800000,
      "source": "purchase"
    }
  ],
  "referralCode": "JOHN123",
  "createdAt": 1701388800000,
  "updatedAt": 1701388800000
}
```

---

### 2. `sessions`
**Purpose**: JWT authentication sessions

```typescript
interface SessionDoc {
  _id: ObjectId
  tokenHash: string                // SHA-256 hash of JWT (unique)
  userId: string                   // User ID (reference to users)
  expiresAt: number                // Expiration timestamp
  createdAt: number                // Creation timestamp
  ip?: string                      // Client IP address
  userAgent?: string               // Client user agent
}
```

**Indexes**:
- `{ tokenHash: 1 }` - unique
- `{ userId: 1 }`
- `{ expiresAt: 1 }` - TTL index (auto-delete expired sessions)

**TTL**: Auto-deleted when `expiresAt` is reached

---

### 3. `verification_tokens`
**Purpose**: Email verification and password reset tokens

```typescript
interface VerificationTokenDoc {
  _id: ObjectId
  tokenHash: string                // SHA-256 hash of token (unique)
  userId: string                   // User ID
  purpose: "email_verification" | "password_reset"
  expiresAt: number                // Expiration timestamp
  createdAt: number                // Creation timestamp
  usedAt?: number                  // When token was used (one-time use)
}
```

**Indexes**:
- `{ tokenHash: 1 }` - unique
- `{ userId: 1, purpose: 1 }`
- `{ expiresAt: 1 }` - TTL index

**TTL**: Auto-deleted after 24 hours

---

### 4. `rate_limits`
**Purpose**: API rate limiting (prevent abuse)

```typescript
interface RateLimitDoc {
  _id: ObjectId
  key: string                      // Unique key (e.g., "user:123:api", "ip:1.2.3.4")
  count: number                    // Request count
  expiresAt: number                // Reset timestamp
}
```

**Indexes**:
- `{ key: 1 }` - unique
- `{ expiresAt: 1 }` - TTL index

**TTL**: Auto-deleted when window expires

---

### 5. `projects`
**Purpose**: Website analysis projects

```typescript
interface MirrorProject {
  _id: ObjectId
  id: string                       // Unique project ID (UUID)
  userId: string                   // Owner user ID
  
  // Source website
  sourceUrl: string                // Original URL (e.g., "https://example.com")
  crawlMode: "smart" | "deep"      // Analysis mode
  
  // Project metadata
  name: string                     // Project name
  description?: string             // User description
  
  // Status
  state: "analyzing" | "ready" | "building" | "deployed" | "failed"
  
  // Analysis results
  evidence?: WebsiteEvidence       // Crawl results (screenshots, pages, etc.)
  spec?: ApplicationSpecification  // AI-generated spec (deep crawl only)
  
  // Build results
  buildRuns: BuildRun[]            // Build/deploy history
  liveUrl?: string                 // Deployed URL (Vercel)
  githubRepo?: string              // GitHub repository URL
  
  // Activity timeline
  activities: ActivityEvent[]      // Timeline of events
  
  // Metadata
  createdAt: number
  updatedAt: number
  completedAt?: number
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ userId: 1, updatedAt: -1 }` - for user's project list

**Example**:
```json
{
  "id": "proj_abc123",
  "userId": "user_xyz",
  "sourceUrl": "https://example.com",
  "crawlMode": "smart",
  "name": "Example Clone",
  "state": "ready",
  "evidence": {
    "pages": [...],
    "screenshots": [...]
  },
  "activities": [
    {
      "type": "crawl_started",
      "timestamp": 1701388800000
    },
    {
      "type": "crawl_completed",
      "timestamp": 1701389000000
    }
  ],
  "createdAt": 1701388800000,
  "updatedAt": 1701389000000
}
```

---

### 6. `build_runs`
**Purpose**: Build and deployment history

```typescript
interface BuildRun {
  _id: ObjectId
  id: string                       // Unique build ID
  mirrorProjectId: string          // Parent project ID
  
  // Build status
  status: "pending" | "building" | "success" | "failed"
  
  // Results
  liveUrl?: string                 // Deployed URL
  githubRepo?: string              // GitHub repo URL
  vercelProjectId?: string         // Vercel project ID
  buildLogs?: string               // Build output logs
  error?: string                   // Error message (if failed)
  
  // Metadata
  startedAt: number
  completedAt?: number
  duration?: number                // Milliseconds
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ mirrorProjectId: 1, startedAt: -1 }`

---

### 7. `project_assets`
**Purpose**: Generated assets (images, fonts, etc.)

```typescript
interface ProjectAssetDoc {
  _id: ObjectId
  id: string                       // Unique asset ID
  userId: string                   // Owner user ID
  mirrorProjectId: string          // Parent project ID
  
  // Asset details
  assetType: "image" | "font" | "icon" | "other"
  originalUrl: string              // Original URL
  storedUrl: string                // Our CDN URL (if re-hosted)
  filename: string                 // File name
  fileSize: number                 // Bytes
  mimeType: string                 // MIME type
  
  // Metadata
  createdAt: number
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ userId: 1, createdAt: -1 }`

---

## Billing Collections

### 8. `credit_ledger`
**Purpose**: Complete audit trail of all credit transactions

```typescript
interface CreditLedgerEntry {
  _id: ObjectId
  id: string                       // Unique entry ID
  userId: string                   // User ID
  
  // Transaction details
  transactionType: "grant" | "charge" | "refund" | "deduction"
  amount: number                   // Credits (positive or negative)
  creditType: "subscription" | "permanent"
  
  // Balance tracking
  balanceBefore: number            // User's balance before transaction
  balanceAfter: number             // User's balance after transaction
  
  // Reference (what triggered this transaction)
  referenceType?: "project" | "build" | "purchase" | "subscription" | "referral"
  referenceId?: string             // ID of the triggering entity
  
  // Metadata
  description: string              // Human-readable description
  metadata?: Record<string, unknown>
  idempotencyKey: string           // Prevent duplicate transactions (unique)
  
  // Timestamps
  createdAt: number
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ userId: 1, createdAt: -1 }` - user's transaction history
- `{ userId: 1, creditType: 1, createdAt: -1 }` - filtered history
- `{ idempotencyKey: 1 }` - unique (prevent duplicates)
- `{ transactionType: 1, createdAt: -1 }` - admin reports
- `{ referenceType: 1, referenceId: 1 }` - find related transactions
- `{ createdAt: -1 }` - time-series queries

**Example**:
```json
{
  "id": "ledger_abc123",
  "userId": "user_xyz",
  "transactionType": "charge",
  "amount": -20,
  "creditType": "subscription",
  "balanceBefore": 120,
  "balanceAfter": 100,
  "referenceType": "project",
  "referenceId": "proj_abc123",
  "description": "Smart crawl for example.com",
  "idempotencyKey": "project:proj_abc123:crawl",
  "createdAt": 1701388800000
}
```

---

### 9. `build_authorizations`
**Purpose**: Pre-authorized builds (reserved credits)

```typescript
interface BuildAuthorization {
  _id: ObjectId
  id: string                       // Unique auth ID
  userId: string                   // User ID
  projectId: string                // Project ID
  
  // Authorization status
  status: "pending" | "consumed" | "expired" | "cancelled"
  
  // Credit reservation
  creditsReserved: number          // Amount reserved
  creditType: "subscription" | "permanent"
  
  // Metadata
  expiresAt: number                // Authorization expiry
  createdAt: number
  consumedAt?: number
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ userId: 1, createdAt: -1 }`
- `{ projectId: 1, createdAt: -1 }`
- `{ status: 1, createdAt: -1 }`
- `{ expiresAt: 1 }` - TTL index

---

### 10. `payment_records`
**Purpose**: Stripe payment history

```typescript
interface PaymentRecord {
  _id: ObjectId
  id: string                       // Our payment ID
  dodoPaymentId: string            // Stripe payment intent ID (unique)
  userId: string                   // User ID
  
  // Payment details
  amount: number                   // Amount in cents
  currency: string                 // "usd"
  status: "pending" | "succeeded" | "failed" | "refunded"
  
  // Product details
  productType: "credit_pack" | "subscription"
  creditsGranted?: number          // Credits from this payment
  
  // Stripe metadata
  stripeCustomerId: string         // Stripe customer ID
  paymentMethod?: string           // Payment method type
  
  // Metadata
  createdAt: number
  updatedAt: number
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ dodoPaymentId: 1 }` - unique (Stripe ID)
- `{ userId: 1, createdAt: -1 }`
- `{ status: 1, createdAt: -1 }`

---

### 11. `subscription_records`
**Purpose**: Stripe subscription tracking

```typescript
interface SubscriptionRecord {
  _id: ObjectId
  id: string                       // Our subscription ID
  dodoSubscriptionId: string       // Stripe subscription ID (unique)
  userId: string                   // User ID
  
  // Subscription details
  planId: string                   // "starter" | "pro" | "business"
  status: "active" | "cancelled" | "past_due" | "unpaid"
  
  // Billing cycle
  currentPeriodStart: number       // Timestamp
  currentPeriodEnd: number         // Timestamp
  
  // Credits
  creditsPerMonth: number          // Monthly credit grant
  
  // Stripe metadata
  stripeCustomerId: string
  cancelAtPeriodEnd: boolean       // User scheduled cancellation
  
  // Metadata
  createdAt: number
  updatedAt: number
  cancelledAt?: number
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ dodoSubscriptionId: 1 }` - unique (Stripe ID)
- `{ userId: 1, createdAt: -1 }`
- `{ status: 1, createdAt: -1 }`

---

## System Collections

### 12. `topups`
**Purpose**: Credit pack purchases (legacy, may merge with payment_records)

```typescript
interface TopUpDoc {
  _id: ObjectId
  id: string
  userId: string
  paymentReference: string         // Unique payment reference
  amount: number                   // Credits purchased
  status: "pending" | "completed" | "failed"
  expiresAt: number
  createdAt: number
}
```

---

### 13. `planning_runs`
**Purpose**: AI pipeline execution logs (for debugging)

```typescript
interface PlanningRunDoc {
  _id: ObjectId
  id: string                       // Unique run ID
  projectId: string                // Parent project ID
  userId: string                   // User ID
  
  // Pipeline execution
  stageResults: Record<string, unknown>  // Output from each stage
  errors: Array<{ stage: string; error: string }>
  
  // Metadata
  startedAt: number
  completedAt?: number
  duration?: number
  createdAt: number
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ projectId: 1 }`
- `{ userId: 1, startedAt: -1 }`
- `{ createdAt: 1 }` - TTL index (90-day retention)

**TTL**: Auto-deleted after 90 days

---

### 14. `firecrawl_cache`
**Purpose**: Cache crawl results to avoid re-crawling same URLs

```typescript
interface FirecrawlCacheDoc {
  _id: ObjectId
  url: string                      // Normalized URL
  crawlMode: "smart" | "deep"      // Cache key part
  
  // Cached data
  evidence: unknown                // WebsiteEvidence JSON
  
  // Timestamps
  collectedAt: number              // When crawl happened
  expiresAt: number                // Cache expiration
  createdAt: number
}
```

**Indexes**:
- `{ url: 1, crawlMode: 1 }` - unique (composite cache key)
- `{ expiresAt: 1 }` - TTL index

**TTL**: Auto-deleted after 7 days

---

### 15. `webhook_events`
**Purpose**: Stripe webhook event log

```typescript
interface WebhookEventDoc {
  _id: ObjectId
  id: string                       // Our event ID
  webhookId: string                // Stripe event ID (unique)
  eventType: string                // "payment_intent.succeeded", etc.
  
  // Event data
  payload: unknown                 // Full Stripe event payload
  status: "processed" | "failed" | "ignored"
  
  // Metadata
  receivedAt: number
  processedAt?: number
  error?: string
}
```

**Indexes**:
- `{ id: 1 }` - unique, sparse
- `{ webhookId: 1 }` - unique (Stripe event ID)
- `{ eventType: 1, receivedAt: -1 }`
- `{ status: 1, receivedAt: -1 }`
- `{ receivedAt: -1 }`

---

## Additional Collections (Minor)

### 16. `provider_usage`
**Purpose**: Track API usage (OpenRouter, Firecrawl)

### 17. `publish_events`
**Purpose**: Deployment event log

### 18. `referrals`
**Purpose**: Referral program tracking

### 19. `doc_feedback`
**Purpose**: Documentation feedback votes

---

## Database Maintenance

### Backups
- **Automatic**: MongoDB Atlas daily backups (7-day retention)
- **Manual**: Export via `mongodump` before major changes

### Monitoring
- MongoDB Atlas monitoring dashboard
- Alerts for high CPU, memory, connections
- Slow query alerts (>100ms)

### Optimization
- Indexes are created on first app startup
- TTL indexes automatically clean up expired data
- Compound indexes optimize common query patterns

---

## Migration Scripts

Located in `lib/db/migrations/` (if any)

### Running Migrations
```bash
npm run db:migrate
```

### Creating Migrations
```bash
npm run db:create-migration <name>
```

---

## Connection String

**Format**:
```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

**Environment Variable**:
```
MONGODB_URI=mongodb+srv://...
```

**Location**: `.env.local` (NOT committed to git)

---

## Database Access

### Production
- MongoDB Atlas web UI: https://cloud.mongodb.com
- MongoDB Compass (GUI): Connection string from `.env.local`

### Local Development
- Same database (no local MongoDB required)
- All environments share MongoDB Atlas

---

## Query Examples

### Find user by email
```javascript
const user = await usersCol().findOne({ email: "user@example.com" })
```

### Get user's projects
```javascript
const projects = await projectsCol()
  .find({ userId: user.id })
  .sort({ updatedAt: -1 })
  .toArray()
```

### Get user's credit history
```javascript
const ledger = await creditLedgerCol()
  .find({ userId: user.id })
  .sort({ createdAt: -1 })
  .limit(50)
  .toArray()
```

### Check cache for URL
```javascript
const cached = await firecrawlCacheCol().findOne({
  url: normalizedUrl,
  crawlMode: "smart",
  expiresAt: { $gt: Date.now() }
})
```

---

**Related Documentation**:
- **API**: See `API_ENDPOINTS.md` for endpoints that interact with these collections
- **Credits**: See `CREDIT_SYSTEM.md` for credit system details
- **Code**: See `lib/db/collections.ts` for TypeScript interfaces

**Next**: Read `API_ENDPOINTS.md`
