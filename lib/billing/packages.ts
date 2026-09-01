import type { CreditPackage } from "./types"

/**
 * Customer-facing credit packages for top-up.
 * 1 MirrorSite credit = 1 UGX.
 *
 * These packages can be updated without code changes by modifying this array,
 * or moved to a database collection in the future.
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pkg_5k", credits: 5_000, priceUGX: 5_000, label: "5,000 Credits" },
  { id: "pkg_10k", credits: 10_000, priceUGX: 10_000, label: "10,000 Credits" },
  { id: "pkg_25k", credits: 25_000, priceUGX: 25_000, label: "25,000 Credits", popular: true },
  { id: "pkg_50k", credits: 50_000, priceUGX: 50_000, label: "50,000 Credits" },
  { id: "pkg_100k", credits: 100_000, priceUGX: 100_000, label: "100,000 Credits" },
]

/**
 * Customer-facing application generation tiers.
 * These are the prices shown to users for building applications.
 */
export const APPLICATION_TIERS = {
  simple: { credits: 25_000, label: "Simple", description: "For smaller applications and straightforward website experiences." },
  medium: { credits: 50_000, label: "Medium", description: "For more capable full-stack applications." },
  complex: { credits: 75_000, label: "Complex", description: "For advanced application projects." },
} as const

export type ApplicationTier = keyof typeof APPLICATION_TIERS

/** Look up a package by id. Returns undefined for unknown ids. */
export function getPackageById(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id)
}

/** Payment recipient details for Mobile Money. */
export const PAYMENT_RECIPIENT = {
  name: "Biira Keziah",
  phone: "+256 761 819 885",
  phoneNormalized: "+256761819885",
} as const

/** Payment reference expiry (24 hours). */
export const REFERENCE_EXPIRY_MS = 24 * 60 * 60 * 1000

/** Welcome bonus credits for new users. */
export const WELCOME_BONUS_CREDITS = 500
