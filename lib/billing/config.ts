/**
 * MirrorSite AI — Centralized Billing Configuration
 *
 * ONE place for all billing constants, pricing, cost models, and plans.
 * No other file should hard-code billing values.
 *
 * @module lib/billing/config
 */

// ─── Currency ────────────────────────────────────────────────────────────────

export const DEFAULT_BILLING_CURRENCY = "USD" as const

// ─── Internal Baseline Cost Model ────────────────────────────────────────────

export interface BaselineTier {
  units: number
  costUSD: number
}

export const BASELINE_COST_MODEL_V1 = {
  version: "BASELINE_COST_MODEL_V1" as const,
  currency: "USD" as const,
  tiers: [
    { units: 200, costUSD: 20 },
    { units: 500, costUSD: 45 },
    { units: 1_000, costUSD: 85 },
    { units: 5_000, costUSD: 350 },
    { units: 15_000, costUSD: 1_000 },
  ] as BaselineTier[],
}

/**
 * Convert MirrorSite Credits → Baseline Cost Units.
 * 1,000 MirrorSite Credits = 1 Baseline Cost Unit
 */
export const CREDITS_PER_BASELINE_UNIT = 1_000

// ─── Pricing Model ───────────────────────────────────────────────────────────

export const PRICING_MODEL_VERSION = "MIRRORSITE_PRICING_V1" as const
export const COST_MODEL_VERSION = "BASELINE_COST_MODEL_V1" as const

// ─── Application Build Pricing ───────────────────────────────────────────────

export interface BuildTier {
  id: string
  label: string
  credits: number
  description: string
}

export const BUILD_TIERS: Record<string, BuildTier> = {
  simple: {
    id: "simple",
    label: "Simple",
    credits: 50_000,
    description: "For smaller applications and straightforward website experiences.",
  },
  medium: {
    id: "medium",
    label: "Medium",
    credits: 75_000,
    description: "For more capable full-stack applications.",
  },
  complex: {
    id: "complex",
    label: "Complex",
    credits: 100_000,
    description: "For advanced application projects.",
  },
}

// ─── Subscription Plans ──────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string
  name: string
  tagline: string
  priceUSD: number
  mirrorCredits: number
  interval: "monthly" | "yearly"
  active: boolean
  custom?: boolean
  popular?: boolean
  /** Features included in this plan — rendered as a checklist */
  features: string[]
  /** Features explicitly NOT included — rendered with an X for contrast */
  notIncluded?: string[]
  /** Dodo product ID — set in environment or database */
  dodoProductId?: string
  /** Dodo price ID — set in environment or database */
  dodoPriceId?: string
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  // ── Free (default for all new accounts) ────────────────────────────────
  {
    id: "free",
    name: "Free",
    tagline: "Your starting point. Verify your email and begin building.",
    priceUSD: 0,
    mirrorCredits: 0,          // No monthly grant — one-time 500-credit welcome bonus on email verification
    interval: "monthly",
    active: true,
    features: [
      "500 welcome credits on email verification",
      "Access to the MirrorSite AI workspace",
      "All cloning models (crawl & scrape agents)",
      "Advanced site analysis",
      "Built-in database & infrastructure (limited)",
      "Community support",
    ],
    notIncluded: [
      "Monthly credit grants",
      "Built-in code editor",
      "AI code fixes & implementations",
      "Edit code in editor or visually",
      "Download source code",
      "Sync with GitHub",
      "Use your own domain",
      "Parallel AI agents",
      "Priority builds",
      "Direct support",
    ],
  },

  // ── Explorer ────────────────────────────────────────────────────────────
  {
    id: "explorer",
    name: "Explorer",
    tagline: "Get started and explore what MirrorSite AI can do.",
    priceUSD: 12,
    mirrorCredits: 50_000,
    interval: "monthly",
    active: true,
    dodoProductId: process.env.DODO_PRODUCT_EXPLORER,
    features: [
      "Everything in Free, plus:",
      "50,000 MirrorSite Credits / month",
      "Built-in code editor",
      "AI code fixes & implementations",
      "Limited multi-section code editing",
      "Up to 30 parallel AI agents",
      "Latest powered build models",
      "Incoming API key & deployment access",
      "Full application builds (no follow-ups needed)",
      "Deployment system — sell & earn on marketplace",
      "Database management & storage",
      "Limited team support",
    ],
    notIncluded: [
      "Edit code in editor or visually",
      "Download source code",
      "Sync with GitHub",
      "Use your own domain",
      "Priority builds",
      "Direct support",
    ],
  },

  // ── Starter ─────────────────────────────────────────────────────────────
  {
    id: "starter",
    name: "Starter",
    tagline: "More credits and full editing power for active builders.",
    priceUSD: 79,
    mirrorCredits: 300_000,
    interval: "monthly",
    active: true,
    dodoProductId: process.env.DODO_PRODUCT_STARTER,
    features: [
      "Everything in Explorer, plus:",
      "300,000 MirrorSite Credits / month",
      "Edit your code — in the editor or visually",
      "Download your source code",
      "Sync with GitHub",
      "Use your own domain",
      "Full multi-section code editing",
      "Standard team support",
    ],
    notIncluded: [
      "Priority builds",
      "Direct support",
    ],
  },

  // ── Business ────────────────────────────────────────────────────────────
  {
    id: "business",
    name: "Business",
    tagline: "The full MirrorSite AI experience for serious builders.",
    priceUSD: 139,
    mirrorCredits: 600_000,
    interval: "monthly",
    active: true,
    popular: true,
    dodoProductId: process.env.DODO_PRODUCT_BUSINESS,
    features: [
      "Everything in Starter, plus:",
      "600,000 MirrorSite Credits / month",
      "Priority builds",
      "Team support",
    ],
    notIncluded: [
      "Direct support",
    ],
  },

  // ── Professional ────────────────────────────────────────────────────────
  {
    id: "professional",
    name: "Professional",
    tagline: "Maximum credits, priority access, and direct support.",
    priceUSD: 219,
    mirrorCredits: 1_400_000,
    interval: "monthly",
    active: true,
    dodoProductId: process.env.DODO_PRODUCT_PROFESSIONAL,
    features: [
      "Everything in Business, plus:",
      "1,400,000 MirrorSite Credits / month",
      "Direct support",
      "Full team support",
    ],
  },

  // ── Enterprise ──────────────────────────────────────────────────────────
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Custom volume, dedicated infrastructure, and white-glove support.",
    priceUSD: 499,
    mirrorCredits: 5_000_000,
    interval: "monthly",
    active: true,
    custom: true,
    dodoProductId: process.env.DODO_PRODUCT_ENTERPRISE,
    features: [
      "Everything in Professional, plus:",
      "5,000,000+ MirrorSite Credits / month",
      "Custom credit volume",
      "Dedicated infrastructure",
      "SLA-backed uptime",
      "White-glove onboarding",
      "Dedicated account manager",
      "Custom integrations on request",
      "Enterprise team support",
    ],
  },
]

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id)
}

// ─── Permanent Credit Packs ──────────────────────────────────────────────────

export interface PermanentCreditPack {
  id: string
  credits: number
  priceUSD: number
  label: string
  popular?: boolean
  /** Dodo product ID — set in environment or database */
  dodoProductId?: string
  /** Dodo price ID — set in environment or database */
  dodoPriceId?: string
}

export const PERMANENT_CREDIT_PACKS: PermanentCreditPack[] = [
  { id: "perm_200k", credits: 200_000, priceUSD: 59, label: "200,000 Credits", dodoProductId: process.env.DODO_PRODUCT_PERM_200K },
  { id: "perm_500k", credits: 500_000, priceUSD: 119, label: "500,000 Credits", popular: true, dodoProductId: process.env.DODO_PRODUCT_PERM_500K },
  { id: "perm_1m", credits: 1_000_000, priceUSD: 219, label: "1,000,000 Credits", dodoProductId: process.env.DODO_PRODUCT_PERM_1M },
  { id: "perm_5m", credits: 5_000_000, priceUSD: 859, label: "5,000,000 Credits", dodoProductId: process.env.DODO_PRODUCT_PERM_5M },
  { id: "perm_15m", credits: 15_000_000, priceUSD: 2_499, label: "15,000,000 Credits", dodoProductId: process.env.DODO_PRODUCT_PERM_15M },
]

export function getPackById(id: string): PermanentCreditPack | undefined {
  return PERMANENT_CREDIT_PACKS.find((p) => p.id === id)
}

// ─── Welcome & Referral Credits ──────────────────────────────────────────────

export const WELCOME_BONUS_CREDITS = 500
export const REFERRAL_VERIFICATION_REWARD = 500
export const REFERRAL_MILESTONE_REWARD = 1_500
export const REFERRAL_MILESTONE_THRESHOLD = 75_000

// ─── Credit Types ────────────────────────────────────────────────────────────

export type CreditType = "subscription" | "permanent"

/**
 * Credit consumption order: subscription credits are consumed first,
 * then permanent credits.
 */
export const CONSUMPTION_ORDER: CreditType[] = ["subscription", "permanent"]

// ─── Build Authorization Statuses ────────────────────────────────────────────

export type BuildAuthorizationStatus =
  | "pending"
  | "authorized"
  | "reserved"
  | "executing"
  | "finalized"
  | "released"
  | "failed"
  | "expired"
  | "cancelled"

// ─── Ledger Transaction Types ────────────────────────────────────────────────

export type LedgerTransactionType =
  | "signup_bonus"
  | "referral_bonus"
  | "credit_purchase"
  | "subscription_grant"
  | "subscription_renewal"
  | "build_reservation"
  | "build_finalization"
  | "build_release"
  | "build_refund"
  | "promotional_grant"
  | "admin_adjustment"
  | "subscription_expiration"
  | "refund_reversal"
  | "other_reversal"
  | "infrastructure_purchase"

// ─── Payment States ──────────────────────────────────────────────────────────

export type PaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed"

// ─── Subscription States ─────────────────────────────────────────────────────

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired"
  | "payment_failed"

// ─── Internal Cost Categories (Admin Only) ───────────────────────────────────

export const ACTUAL_COST_CATEGORIES = [
  "ai_model",
  "ai_tokens",
  "firecrawl",
  "database",
  "storage",
  "compute",
  "hosting",
  "deployment",
  "bandwidth",
  "third_party_apis",
  "dodo_fees",
  "tax_reserve",
  "infrastructure",
] as const

// ─── Customer-Facing Label Helpers ───────────────────────────────────────────

export const CREDIT_UNIT_NAME = "MirrorSite Credits"
export const BILLING_SYSTEM_NAME = "MirrorSite Billing"

/** Format a credit amount for display. */
export function formatCredits(amount: number): string {
  return `${amount.toLocaleString()} ${CREDIT_UNIT_NAME}`
}

/** Format a USD price for display. */
export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}
