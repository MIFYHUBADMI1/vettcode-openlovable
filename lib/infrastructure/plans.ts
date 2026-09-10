/**
 * MirrorSite Infrastructure Plans — centralized configuration.
 *
 * Each plan defines:
 *   - Customer-facing storage limit
 *   - MirrorSite credit price (monthly)
 *   - Internal Totalum infrastructure credit cap (monthly)
 *
 * 1 MirrorSite credit = 1 UGX.
 * Totalum credits are strictly internal and never exposed to customers.
 */

export type InfrastructurePlanId = "testing" | "basic" | "starter" | "pro" | "business" | "enterprise"

export interface InfrastructurePlan {
  id: InfrastructurePlanId
  name: string
  /** Customer-facing storage as a human-readable label. */
  storageLabel: string
  /** Storage in bytes (for internal comparison). */
  storageBytes: number
  /** Monthly MirrorSite credit cost. 0 = free. */
  mirrorSitePrice: number
  /** Internal Totalum infrastructure credit cap per month. */
  totalumInfrastructureCredits: number
  /** Whether this is a paid plan. */
  isPaid: boolean
  /** Customer-facing description. */
  description: string
}

export const INFRASTRUCTURE_PLANS: Record<InfrastructurePlanId, InfrastructurePlan> = {
  testing: {
    id: "testing",
    name: "Testing",
    storageLabel: "Up to 50 MB",
    storageBytes: 50 * 1024 * 1024, // 50 MB
    mirrorSitePrice: 0,
    totalumInfrastructureCredits: 5,
    isPaid: false,
    description: "Free testing access for new applications.",
  },
  basic: {
    id: "basic",
    name: "Basic",
    storageLabel: "Up to 100 MB",
    storageBytes: 100 * 1024 * 1024, // 100 MB
    mirrorSitePrice: 5_000,
    totalumInfrastructureCredits: 10,
    isPaid: true,
    description: "For small applications with light database usage.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    storageLabel: "Up to 1 GB",
    storageBytes: 1024 * 1024 * 1024, // 1 GB
    mirrorSitePrice: 15_000,
    totalumInfrastructureCredits: 30,
    isPaid: true,
    description: "For growing applications with moderate database needs.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    storageLabel: "Up to 5 GB",
    storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    mirrorSitePrice: 35_000,
    totalumInfrastructureCredits: 100,
    isPaid: true,
    description: "For capable full-stack applications.",
  },
  business: {
    id: "business",
    name: "Business",
    storageLabel: "Up to 25 GB",
    storageBytes: 25 * 1024 * 1024 * 1024, // 25 GB
    mirrorSitePrice: 95_000,
    totalumInfrastructureCredits: 300,
    isPaid: true,
    description: "For advanced applications with high infrastructure demands.",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    storageLabel: "Custom",
    storageBytes: Infinity,
    mirrorSitePrice: 0, // Custom pricing
    totalumInfrastructureCredits: 0, // Custom
    isPaid: true,
    description: "Custom infrastructure for large-scale applications. Contact us.",
  },
}

/** Ordered list of plans for UI display (excludes enterprise). */
export const PAID_PLAN_ORDER: InfrastructurePlanId[] = ["basic", "starter", "pro", "business"]

/** All plans including free tier. */
export const ALL_PLAN_ORDER: InfrastructurePlanId[] = ["testing", "basic", "starter", "pro", "business", "enterprise"]

/** Get a plan by ID. Returns undefined for unknown IDs. */
export function getInfrastructurePlan(id: string): InfrastructurePlan | undefined {
  return INFRASTRUCTURE_PLANS[id as InfrastructurePlanId]
}

/** Format storage bytes to human-readable. */
export function formatStorage(bytes: number): string {
  if (bytes === Infinity) return "Custom"
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${bytes} bytes`
}

/** Format MirrorSite credits as price. */
export function formatPrice(credits: number): string {
  if (credits === 0) return "Free"
  return `${credits.toLocaleString()} credits/month`
}
