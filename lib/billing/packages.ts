/**
 * MirrorSite AI — Billing Packages (Unified)
 *
 * Re-exports from the centralized config. This file preserves backward
 * compatibility for existing imports while the underlying values now
 * come from lib/billing/config.ts.
 *
 * @module lib/billing/packages
 */

import {
  PERMANENT_CREDIT_PACKS,
  BUILD_TIERS,
  WELCOME_BONUS_CREDITS,
  getPackById,
} from "./config"
import type { PermanentCreditPack, BuildTier } from "./config"

// ─── Re-exports for backward compatibility ───────────────────────────────────

/**
 * @deprecated Use PERMANENT_CREDIT_PACKS from lib/billing/config.ts
 * Customer-facing permanent credit packages for purchase via Dodo.
 */
export const CREDIT_PACKAGES: PermanentCreditPack[] = PERMANENT_CREDIT_PACKS

/**
 * Customer-facing application generation tiers.
 * Server-side authoritative pricing.
 */
export const APPLICATION_TIERS = BUILD_TIERS

export type ApplicationTier = keyof typeof BUILD_TIERS

/** Look up a package by id. Returns undefined for unknown ids. */
export function getPackageById(id: string): PermanentCreditPack | undefined {
  return getPackById(id)
}

// ─── Removed legacy values ───────────────────────────────────────────────────
// PAYMENT_RECIPIENT — removed (was for MTN/Airtel mobile money)
// REFERENCE_EXPIRY_MS — removed (was for manual payment references)
// priceUGX fields — removed (currency is now USD)

/** Welcome bonus credits for new users. */
export const WELCOME_BONUS = WELCOME_BONUS_CREDITS

/**
 * @deprecated Legacy payment recipient — was for MTN/Airtel mobile money.
 * Kept for backward compatibility with legacy top-up code.
 */
export const PAYMENT_RECIPIENT = {
  name: "Biira Keziah",
  phone: "+256 761 819 885",
  phoneNormalized: "+256761819885",
} as const

/**
 * @deprecated Legacy reference expiry — was for manual payment references.
 */
export const REFERENCE_EXPIRY_MS = 24 * 60 * 60 * 1000
