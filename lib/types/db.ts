/**
 * MongoDB document shapes for every persisted collection (spec sections 3–9,
 * 20). These mirror the existing in-app model types (`MirrorProject`,
 * `BuildRun`, `CreditTransaction`) plus everything net-new for this phase:
 * users, sessions, verification/reset tokens, rate-limit buckets, provider
 * usage, and project assets.
 */
import type { ObjectId } from "mongodb"
import type { MirrorProject, BuildRun, CreditTransaction } from "@/lib/types/project"

export type AuthProvider = "password" | "google" | "github"

export interface UserOnboarding {
  source?: string
  role?: string
  signalType?: "url" | "idea"
  /** New founder-focused field (set during onboarding). */
  businessDescription?: string
  destination?: string
  businessGoal?: string
  revenueTarget?: string
  targetUsers?: string
  effortScale?: number
  hoursPerDay?: string
  intent?: string
  selectedPlanId?: string
  completedAt?: number
  dismissedAt?: number
}

/**
 * A single credit bucket — one entry per subscription grant or plan switch.
 * Multiple buckets can coexist; they are consumed oldest-expiry-first.
 */
export interface CreditBucket {
  /** The Dodo subscription ID that created this bucket. */
  subscriptionId: string
  /** The plan ID (e.g. "explorer", "business"). */
  planId: string
  /** Credits remaining in this bucket. */
  amount: number
  /** Original amount granted (for reference). */
  originalAmount: number
  /** When this bucket's credits expire (epoch ms). */
  expiresAt: number
  /** When this bucket was created (epoch ms). */
  createdAt: number
}

export interface UserDoc {
  _id: ObjectId
  id: string // string mirror of _id for callers that expect a string id
  email: string
  name: string
  passwordHash?: string
  authProvider: AuthProvider
  googleId?: string
  githubId?: string
  githubUsername?: string
  githubAccessToken?: string
  emailVerified: boolean
  imageUrl?: string
  imageFileId?: string
  /** @deprecated Use subscriptionCredits + permanentCredits instead. Kept for migration. */
  credits: number
  /** Subscription credits — expire at end of billing period, consumed first. */
  subscriptionCredits: number
  /** Permanent credits — never expire, consumed after subscription credits. */
  permanentCredits: number
  /** Start of the current subscription billing period (epoch ms). */
  subscriptionPeriodStart?: number
  /** End of the current subscription billing period (epoch ms). */
  subscriptionPeriodEnd?: number
  /**
   * Individual subscription credit buckets, each with its own expiry.
   * On plan switch, new bucket is pushed instead of replacing the old one.
   * Consumed oldest-expiry-first. The sum of all bucket.amount values
   * equals subscriptionCredits (kept in sync atomically).
   */
  creditBuckets?: CreditBucket[]
  isAdmin?: boolean
  onboarding?: UserOnboarding
  suspended?: boolean
  suspendedAt?: number
  suspendedReason?: string
  banned?: boolean
  bannedAt?: number
  bannedReason?: string
  createdAt: number
  updatedAt: number
  lastLoginAt?: number
  deletedAt?: number
  /** User's preferred UI theme. Defaults to "system" if not set. */
  theme?: "system" | "dark" | "light" | "light-blue" | "glass"
  /** Unique referral code for this user (e.g. MSA-X7K29P). Generated on first access. */
  referralCode?: string
  /** User ID of the person who referred this user (set once at registration). */
  referredBy?: string
}

// ─── Referral Document ─────────────────────────────────────────────────────

export type ReferralStatus =
  | "registered"
  | "verified"
  | "active"
  | "milestone_reached"
  | "blocked"

export interface ReferralDoc {
  _id: ObjectId
  id: string
  /** The user who referred (referrer). */
  referrerUserId: string
  /** The user who was referred. */
  referredUserId: string
  /** The referral code that was used. */
  referralCode: string
  /** Current status of this referral relationship. */
  status: ReferralStatus
  /** Whether the 500-credit verification reward has been issued. */
  verificationRewardIssued: boolean
  /** Whether the 1,500-credit usage milestone reward has been issued. */
  milestoneRewardIssued: boolean
  /** Cumulative eligible application-generation usage by the referred user (credits consumed on successful builds only). */
  eligibleUsage: number
  /** Risk/fraud flags for admin review. */
  fraudFlags?: string[]
  review?: { decision: "approve" | "block"; adminId: string; reason: string; reviewedAt: number; approvedFlags: string[] }
  createdAt: number
  updatedAt: number
}

export interface SessionDoc {
  _id: ObjectId
  userId: string
  tokenHash: string
  userAgent?: string
  createdAt: number
  expiresAt: Date
}

export type VerificationPurpose = "email_verify" | "password_reset" | "email_change"

export interface VerificationTokenDoc {
  _id: ObjectId
  userId: string
  purpose: VerificationPurpose
  tokenHash: string
  metadata?: Record<string, unknown>
  createdAt: number
  expiresAt: Date
  usedAt?: number
}

export interface RateLimitDoc {
  _id: ObjectId
  key: string // `${action}:${identifier}`
  count: number
  windowStart: number
  expiresAt: Date
}

export interface ProjectAssetDoc {
  _id: ObjectId
  id: string
  userId: string
  projectId?: string
  kind: "avatar" | "screenshot" | "asset" | "upload" | "visual"
  fileId: string
  filePath: string
  fileName: string
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
  createdAt: number
  /** Optional metadata for visual mockups and other generated content */
  metadata?: Record<string, unknown>
}

export interface ProviderUsageDoc {
  _id: ObjectId
  id: string
  provider: "firecrawl" | "totalum" | "imagekit" | "email"
  operation: string
  userId?: string
  projectId?: string
  succeeded: boolean
  costEstimate?: number
  metadata?: Record<string, unknown>
  createdAt: number
}

// ─── Top-Up Document ───────────────────────────────────────────────────────

export type TopUpStatus =
  | "pending"
  | "awaiting_payment"
  | "payment_submitted"
  | "analyzing"
  | "manual_review"
  | "approved"
  | "rejected"
  | "amount_mismatch"
  | "duplicate"
  | "expired"
  | "cancelled"

export type PaymentNetwork = "mtn" | "airtel"

export interface AIAnalysisResult {
  extractedAmount?: number | null
  extractedCurrency?: string | null
  extractedRecipientName?: string | null
  extractedRecipientPhone?: string | null
  extractedSenderName?: string | null
  extractedSenderPhone?: string | null
  extractedTransactionId?: string | null
  extractedPaymentReference?: string | null
  extractedDate?: string | null
  extractedTime?: string | null
  extractedNetwork?: string | null
  extractedTransactionFee?: string | null
  extractedBalance?: string | null
  otherVisibleInformation?: string | null
  confidence: number
  recommendation: "MATCH" | "REVIEW" | "MISMATCH"
  rawResponse?: string
}

export interface TopUpDoc {
  _id: ObjectId
  id: string
  userId: string
  packageId: string
  credits: number
  expectedAmount: number
  paymentReference: string
  payerPhone: string
  paymentNetwork: PaymentNetwork
  status: TopUpStatus
  evidenceFileIds: string[]
  evidenceHashes: string[]
  aiAnalysis?: AIAnalysisResult
  transactionIdUsed?: string
  verifiedAt?: number
  verifiedBy?: string
  rejectionReason?: string
  createdAt: number
  updatedAt: number
  expiresAt: number
}

// ─── Publish Event Document ──────────────────────────────────────────────────

export type PublishEventStatus = "started" | "success" | "failed"
export type PublishEventType = "subdomain" | "custom_domain"

export interface PublishEventDoc {
  _id: ObjectId
  id: string
  userId: string
  projectId: string
  projectName: string
  eventType: PublishEventType
  status: PublishEventStatus
  creditsCharged: number
  productionUrl?: string
  customDomain?: string
  error?: string
  durationMs?: number
  createdAt: number
}

// ─── Doc Feedback Document ──────────────────────────────────────────────────

export type FeedbackVote = "up" | "down"

export interface DocFeedbackDoc {
  _id: ObjectId
  /** Unique key: `${sectionId}:${visitorId}` to prevent duplicate votes */
  key: string
  /** Doc section ID, e.g. "getting-started" */
  sectionId: string
  /** Anonymous visitor identifier (hashed fingerprint) */
  visitorId: string
  /** The vote */
  vote: FeedbackVote
  createdAt: number
  updatedAt: number
}

// ─── Dodo Webhook Event Document ──────────────────────────────────────────

/**
 * received → (live delivery) processed | unresolved | failed.
 * Phase 3 recovery adds: processing (claimed by a recovery worker — the
 * atomic claim itself, so two workers can never process one event), and
 * manual_review (terminal for operators: retries exhausted or the event is
 * not safely re-processable; NEVER auto-replayed).
 */
export type WebhookEventStatus =
  | "received"
  | "processed"
  | "processing"
  | "failed"
  | "ignored"
  | "unresolved"
  | "manual_review"
export type WebhookEventProvider = "dodo"

export interface WebhookEventDoc {
  _id: ObjectId
  /** Internal id. */
  id: string
  /** The provider that sent the webhook. */
  provider: WebhookEventProvider
  /** The Dodo webhook-id header (unique per event, used for idempotency). */
  webhookId: string
  /** The event type, e.g. "payment.succeeded", "subscription.active". */
  eventType: string
  /** Raw payload body for audit. */
  payload: Record<string, unknown>
  /** SHA-256 hash of the raw payload for integrity checks. */
  payloadHash: string
  /** Processing status. */
  status: WebhookEventStatus
  /** Error message if processing failed. */
  error?: string
  /** Timestamps. */
  receivedAt: number
  processedAt?: number
  /**
   * Phase 3 recovery bookkeeping (all optional — historical docs predate
   * them and are treated as attempts: 0).
   */
  /** Number of processing attempts (live delivery counts as the first). */
  attempts?: number
  /** Last attempt start (live or recovery). */
  lastAttemptAt?: number
  /** Earliest time a recovery worker may claim this event (backoff). */
  nextAttemptAt?: number
  /** Safe, secret-free reason recorded at the terminal manual-review state. */
  reviewReason?: string
}

// ─── Planning Run Document ─────────────────────────────────────────────────

export interface PlanningRunDoc {
  _id: ObjectId
  id: string
  projectId: string
  userId: string
  mode: "idea" | "website" | "deepCrawl"
  startedAt: number
  completedAt?: number
  status: "running" | "completed" | "failed"
  stageResults: Array<{
    stage: string
    model: string
    startedAt: number
    completedAt: number
    durationMs: number
    tokens: number
    success: boolean
    retries: number
    error?: string
  }>
  totalTokens: number
  totalDurationMs: number
  outcome?: {
    specificationId?: string
    qualityScore?: number
    completenessScore?: number
    legacy?: boolean
  }
  error?: string
  createdAt: number
}

// Re-exported for convenience so Mongo-aware modules can import model +
// persistence types from a single place.
export type { MirrorProject, BuildRun, CreditTransaction }

// ─── Explore / Social Document Types ─────────────────────────────────────────

/** A user liking a public project */
export interface ProjectLikeDoc {
  _id: ObjectId
  id: string
  userId: string      // who liked
  projectId: string   // which project
  createdAt: number
}

/** A user following another user */
export interface UserFollowDoc {
  _id: ObjectId
  id: string
  followerId: string  // who is following
  followingId: string // who is being followed
  createdAt: number
}

/** A user forking a public project (creates a new project for them) */
export interface ProjectForkDoc {
  _id: ObjectId
  id: string
  originalProjectId: string   // the source project
  originalUserId: string      // original owner
  forkedProjectId: string     // new project created for the fork
  forkedByUserId: string      // who forked it
  createdAt: number
}

// ─── Explore / Social Document Types ─────────────────────────────────────────

/** A user liking a public project */
export interface ProjectLikeDoc {
  _id: ObjectId
  id: string
  userId: string
  projectId: string
  createdAt: number
}

/** A user following another user */
export interface UserFollowDoc {
  _id: ObjectId
  id: string
  followerId: string
  followingId: string
  createdAt: number
}

/** A fork record — tracks who forked what into which new project */
export interface ProjectForkDoc {
  _id: ObjectId
  id: string
  originalProjectId: string
  originalUserId: string
  forkedProjectId: string
  forkedByUserId: string
  createdAt: number
}

// ─── GitHub Integration ───────────────────────────────────────────────────────

/** Per-project GitHub connection — one doc per project */
export interface ProjectGitHubDoc {
  _id: ObjectId
  id: string
  projectId: string
  userId: string
  /** push = export code to GitHub; build-from = use repo as analysis source */
  mode: "push" | "build-from"
  /** Sub-mode for build-from: clone (build from scratch) or extend (continue existing app) */
  githubSubMode?: "clone" | "extend"
  /** User's custom request for extend mode (what to add/change) */
  userRequest?: string
  repoOwner: string
  repoName: string
  branch: string
  /** Last successful push timestamp */
  lastPushedAt?: number
  /** Last pushed commit SHA */
  lastPushedSha?: string
  /** push status for latest operation */
  pushStatus?: "ok" | "failed" | "skipped_no_source"
  pushError?: string
  createdAt: number
  updatedAt: number
}

// ─── SEO Audits (Phase 3 — W2 SEO & Visibility) ─────────────────────────────
//
// A durable, per-run snapshot of a deterministic audit of a project's OWN
// deployed URL. Findings are derived only from the evidence the Firecrawl
// service actually exposes; anything not observable is stored as `not_observed`
// rather than guessed. No ranking/traffic claims — see lib/marketing/seo.

export type SeoFindingStatus = "pass" | "fail" | "not_observed"

/**
 * Atai's assessment of how much a finding could matter. This is an internal
 * severity used to prioritise work and weight the audit score — it is NOT a
 * prediction of search-engine impact.
 */
export type SeoFindingSeverity = "critical" | "high" | "medium" | "low" | "info"

/** Grouping used by the SEO workspace to filter findings. */
export type SeoFindingCategory =
  | "security"
  | "metadata"
  | "structure"
  | "content"
  | "links"
  | "media"
  | "crawlability"

export interface SeoFinding {
  /** Stable check id (e.g. "title_present"). */
  id: string
  /** Human-readable check label. */
  label: string
  status: SeoFindingStatus
  /**
   * Evidence string when observed (e.g. the title text, a length). NEVER a
   * fabricated number. Omitted when status is `not_observed`.
   */
  observed?: string
  /** Why a check could not be evaluated (missing evidence). */
  note?: string
  /** Optional for audits stored before severity existed (v1.1 addition). */
  severity?: SeoFindingSeverity
  category?: SeoFindingCategory
  /** Page URLs the finding applies to (bounded). Absent for site-wide checks. */
  affectedUrls?: string[]
}

/**
 * Transparent, reproducible internal audit score. Derived ONLY from checks
 * that were actually evaluated (`pass`/`fail`) — a check whose evidence was
 * missing (`not_observed`) is excluded, never counted as a failure.
 */
export interface SeoAuditScore {
  /** Weighted 0-100 score; `null` when no check was eligible to be scored. */
  value: number | null
  /** Scoring algorithm version, so historical audits stay interpretable. */
  version: string
  /** Severity weight contributed by passing / failing eligible checks. */
  passedWeight: number
  failedWeight: number
  /** Checks excluded from scoring because no evidence was available. */
  notApplicable: number
}

/** Priority the model assigns to a recommendation. */
export type SeoRecommendationPriority = "high" | "medium" | "low"

/**
 * AI-generated guidance, always derived from findings Atai actually observed.
 * `origin` is the provenance marker: these are recommendations, never measured
 * search-engine facts.
 */
export interface SeoRecommendation {
  title: string
  /** Why the finding matters, in plain language for a nontechnical founder. */
  whyItMatters: string
  /** The concrete change to make. */
  action: string
  /** Ids of the stored findings this recommendation is grounded in. */
  findingIds: string[]
  priority: SeoRecommendationPriority
  requiresDeveloper: boolean
  /** Page the recommendation applies to, when the finding is page-specific. */
  pageUrl?: string
  origin: "ai_generated_from_observed_findings"
}

/**
 * Refund state for a charged run that did not complete. `pending` means the
 * failed audit is stored but the reversal has not been confirmed yet — the
 * history never claims a refund that did not happen.
 */
export type SeoRefundStatus = "pending" | "refunded" | "not_charged" | "failed"

export interface SeoRefundInfo {
  status: SeoRefundStatus
  /** Credits involved in the reversal (the amount charged for this run). */
  amount?: number
  at?: number
}

/**
 * Provenance of the recommendation step, so the UI can be honest when the AI
 * step was skipped or failed while the deterministic audit succeeded.
 */
export interface SeoRecommendationsMeta {
  status: "generated" | "no_findings" | "unavailable"
  model?: string
  generatedAt?: number
}

export type SeoAuditStatus = "completed" | "failed"

export interface SeoAuditDoc {
  _id: ObjectId
  /** Business id (`seo_...`) — mirrors _id for callers expecting a string. */
  id: string
  userId: string
  projectId: string
  /** The exact URL audited (the project's own recorded production URL). */
  url: string
  status: SeoAuditStatus
  /** Findings snapshot. */
  findings: SeoFinding[]
  /** Counts by status for cheap display. */
  score: { pass: number; fail: number; notObserved: number }
  /** Weighted, versioned score. Absent on audits stored before v1.1. */
  auditScore?: SeoAuditScore
  /** AI guidance grounded in `findings`. Absent when unavailable/skipped. */
  recommendations?: SeoRecommendation[]
  /** Why recommendations are present/absent — never inferred by the UI. */
  recommendationsMeta?: SeoRecommendationsMeta
  /** Pages the crawl actually covered (breadth). */
  pagesCrawled: number
  /** Credits charged for this run (0 when the run was free). */
  creditsCharged: number
  /** Present on failed runs: what happened to the charge. */
  refund?: SeoRefundInfo
  /** Set when status is "failed" — a safe, non-technical reason only. */
  error?: string
  /** Whether the crawl evidence came from the 7-day Firecrawl cache. */
  fromCache: boolean
  startedAt: number
  completedAt?: number
  createdAt: number
}

// ─── Marketing Studio content (Phase 4 — W3) ─────────────────────────────────

/** Fixed, product-defined copy templates. The AI fills these scaffolds; it is
 * never allowed to invent a new "kind" or a publishing action. */
export type StudioTemplate =
  | "landing_hero"
  | "feature_blurb"
  | "email_welcome"
  | "ad_headline"

/**
 * Draft-only lifecycle. There is deliberately NO `published` or `scheduled`
 * status: no publishing integration exists, so the product must never claim
 * one. `ready_for_review` means the founder considers the draft finished.
 */
export type ContentItemStatus = "draft" | "ready_for_review"

/** Content kinds produced by the Market & Grow AI studio. */
export type MarketAssetKind =
  | "copy"
  | "email"
  | "social"
  | "timeline"
  | "blog"
  | "brief"
  | "image"
  | "voice"
  | "video"

/** Stored media for a market asset. Binary data is bounded before storage. */
export interface MarketAssetMedia {
  /** Media family — text assets store no media here (their body is the deliverable). */
  kind: "image" | "audio" | "video"
  /** Inline data URL for image/audio (omitted when too large to store). */
  dataUrl?: string
  mimeType?: string
  /** Async video job reference (the provider generates out of band). */
  jobId?: string
  status?: string
  /** Provider job output, reduced to JSON-safe scalars. */
  providerOutput?: unknown
  /** True when the media exceeded the storage bound and was not persisted. */
  notPersisted?: boolean
}

/** One runtime call made while producing an asset (audit + credit display). */
export interface MarketAssetRuntimeCall {
  requestId: string
  capability: string
  operation: string
  creditsCharged: number
  model?: string
}

/** Provenance for a generated market asset. */
export interface MarketAssetRuntime {
  /** Project API key used automatically, or the workspace session identity. */
  keySource: "project_api_key" | "workspace"
  apiKeyId: string
  keyLabel: string
  calls: MarketAssetRuntimeCall[]
  totalCreditsCharged: number
}

/** The brief the founder gave the studio (shown with the result). */
export interface MarketAssetBrief {
  brief: string
  tone?: string
  language?: string
  channel?: string
  audience?: string
  aspectRatio?: string
  durationSeconds?: number
  voiceStyle?: string
}

/**
 * A single marketing-copy draft. Drafts are DISTINCT from the business-plan
 * `specification` prose: `origin` is always "ai_generated_marketing_content"
 * so nothing here can ever be mistaken for a founder-authored plan section or
 * a measured result. Editing produces a NEW doc chained via `parentContentId`
 * (immutable version history) — there is no publish/scheduling field because
 * publishing needs the job substrate (W4/W5) and is intentionally absent.
 */
export interface ContentItemDoc {
  _id: ObjectId
  /** Business id (`content_...`) — mirrors _id for callers expecting a string. */
  id: string
  userId: string
  projectId: string
  kind: "marketing_copy" | "marketing_asset"
  template: StudioTemplate | "market_studio"
  status: ContentItemStatus
  /** Short human label shown in the Studio list. */
  title: string
  /** The generated (or hand-edited) copy. */
  body: string
  /** 1-based version. v1 is the AI draft; edits append v2, v3 … */
  version: number
  /** For v ≥ 2, the id of the original draft this version chains from. */
  parentContentId?: string
  /** Always "ai_generated_marketing_content" — the content-vs-spec-prose guard. */
  origin: "ai_generated_marketing_content"
  /** Model id used for the initial generation (omitted on pure edits). */
  model?: string
  /** Market & Grow studio asset metadata (absent on plain copy drafts). */
  assetKind?: MarketAssetKind
  media?: MarketAssetMedia
  runtime?: MarketAssetRuntime
  brief?: MarketAssetBrief
  /** Credits charged to create THIS doc (0 for free saves/edits). */
  creditsCharged: number
  /** Optional channel label from the brief (e.g. instagram, email). */
  channel?: string
  /** Founder-managed tags for library organisation (bounded). */
  tags?: string[]
  /**
   * Planned publishing date, stored as an epoch ms. This is a PLAN only —
   * nothing is scheduled with any external platform, and a passed date never
   * means a post was published.
   */
  plannedAt?: number
  /** Set on an alternative generated from this item (not a version chain). */
  variantOf?: string
  createdAt: number
  updatedAt: number
}

// ─── Brand profile (Phase 4 v2) ─────────────────────────────────────────────

/**
 * One persisted, project-scoped brand profile. Values are founder-authored
 * preferences (not measured facts) and are reused to ground every generation.
 */
export interface BrandProfileDoc {
  _id: ObjectId
  id: string
  userId: string
  projectId: string
  /** Optional override for the project name used in copy. */
  brandName?: string
  /** One-line description of the business, if the founder wants it tighter. */
  description?: string
  tone?: string
  audience?: string
  valueProposition?: string
  differentiators?: string[]
  /** Words/phrases to favour. */
  vocabulary?: string[]
  /** Claims or words to avoid (e.g. "best in the world", "guaranteed"). */
  avoid?: string[]
  callToAction?: string
  createdAt: number
  updatedAt: number
}

// ─── Marketing growth tasks (Phase 5 — W4) ──────────────────────────────────

/** Lifecycle of a managed growth task. Deliberately small and reversible. */
export type GrowthTaskStatus = "open" | "done" | "dismissed"

export type GrowthTaskPriority = "low" | "medium" | "high"

/** Provenance of a task row. AI-authored proposals are labelled distinctly
 * from founder-created or next-step-seeded tasks so nothing is mistaken for a
 * measured outcome or an instruction the system has already carried out. */
export type GrowthTaskOrigin = "ai_generated" | "user_created" | "next_step_seed"

/**
 * A managed growth task. This is a LIST, not a scheduler: status/priority/due
 * are recorded and change-logged, but NOTHING here executes on a timer — the
 * job substrate (Phase 0) does not exist and is intentionally not faked.
 * `dueAt`/`completedAt` use a real null (unknown/absent), never 0.
 */
export interface GrowthTaskDoc {
  _id: ObjectId
  /** Business id (`task_...`) — mirrors _id for callers expecting a string. */
  id: string
  userId: string
  projectId: string
  title: string
  detail?: string
  status: GrowthTaskStatus
  priority: GrowthTaskPriority
  /** Epoch ms, or null when the task has no deadline. */
  dueAt: number | null
  /** When seeded from a derived next step, that step's id (a link only). */
  sourceNextStepId?: string
  origin: GrowthTaskOrigin
  createdAt: number
  updatedAt: number
  /** Epoch ms when the task first became "done"; null otherwise. */
  completedAt: number | null
}

/**
 * Append-only audit trail of a task's lifecycle. Never mutated or deleted:
 * every create / status / field change adds a new immutable row so the history
 * is durable and inspectable.
 */
export interface GrowthTaskHistoryDoc {
  _id: ObjectId
  id: string
  taskId: string
  projectId: string
  userId: string
  /** "created" | "status" | "updated". */
  action: "created" | "status" | "updated"
  /** Field that changed for a "status"/"updated" row (omitted on create). */
  field?: "status" | "priority" | "dueAt" | "title"
  from?: string | null
  to?: string | null
  changedBy: string
  reason?: string
  createdAt: number
}

// ─── Marketing campaigns (Phase 6 — W5, planning & tracking only) ────────────

/** Lifecycle of a campaign PLAN. Terminal states are enforced by the service. */
export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled"

/** Channels a founder can plan around. These are LABELS for tracking only —
 * Atai performs NO posting, sending, or spend on any channel here (email
 * execution needs the consent layer; social/ad posting needs per-platform
 * approvals; none exist). */
export type CampaignChannel = "email" | "social" | "content" | "seo" | "referral" | "other"

/** Provenance of a campaign row. AI-proposals are labelled distinctly from
 * founder-created plans; never a measured outcome. */
export type CampaignOrigin = "ai_generated" | "user_created"

/**
 * A campaign PLAN — objectives/channels/budget are TRACKED, not executed or
 * spent. There is deliberately no execution/attempt table here: `campaign_executions`
 * needs the job substrate (Phase 0) which does not exist and is not faked, so a
 * campaign records only what the founder plans and the status they set manually.
 * `plannedBudgetCents` is a founder-entered planning number — Atai never charges,
 * spends, or reports ad spend. `utmCampaign` feeds the pure link-builder only;
 * nothing here mutates the checkout or webhook payloads (that attribution branch
 * is deferred, money-gated). Link-only by projectId — never embedded in `projects`.
 */
export interface CampaignDoc {
  _id: ObjectId
  /** Business id (`campaign_...`) — mirrors _id for callers expecting a string. */
  id: string
  userId: string
  projectId: string
  name: string
  /** The founder's own stated goal. Free text; never a claim or projection. */
  objective: string
  channels: CampaignChannel[]
  status: CampaignStatus
  /** Planned budget as tracked by the founder (integer cents). Never spend. */
  plannedBudgetCents: number | null
  /** UTM `campaign` slug for tracked links (convention helper only). */
  utmCampaign: string | null
  startDate: number | null
  endDate: number | null
  notes?: string
  origin: CampaignOrigin
  createdAt: number
  updatedAt: number
  /** Timestamps of the most recent pause / cancel transitions (null until then). */
  pausedAt: number | null
  cancelledAt: number | null
}

/**
 * Append-only audit trail of a campaign's lifecycle. Never mutated or deleted:
 * every create / status transition / field change adds a new immutable row.
 */
export interface CampaignHistoryDoc {
  _id: ObjectId
  id: string
  campaignId: string
  projectId: string
  userId: string
  action: "created" | "status" | "updated"
  field?:
    | "status"
    | "name"
    | "objective"
    | "channels"
    | "plannedBudgetCents"
    | "utmCampaign"
    | "startDate"
    | "endDate"
    | "notes"
  from?: string | null
  to?: string | null
  changedBy: string
  reason?: string
  createdAt: number
}

