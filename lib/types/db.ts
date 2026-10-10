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

export type WebhookEventStatus = "received" | "processed" | "failed" | "ignored"
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
  /** Pages the crawl actually covered (breadth). */
  pagesCrawled: number
  /** Credits charged for this run (0 when free/failed before charge). */
  creditsCharged: number
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

export type ContentItemStatus = "draft"

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
  kind: "marketing_copy"
  template: StudioTemplate
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
  /** Credits charged to create THIS doc (0 for free saves/edits). */
  creditsCharged: number
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

