import type { PermanentCreditPack, SubscriptionPlan } from "./config"

/**
 * Turns "you can't afford this action" into a concrete purchase.
 *
 * Deliberately pure: it takes the catalog in rather than importing it, so the
 * browser never has to bundle billing configuration (which reads server-only
 * environment variables). No marketing claims in here either — every number is
 * derived from the catalog the /pricing page already shows.
 */

export type UpgradeKind = "pack" | "plan"

export interface UpgradeOption {
  kind: UpgradeKind
  /** Value to send as `productId` to /api/billing/checkout. */
  productId: string
  title: string
  credits: number
  priceUSD: number
  cadence: "one-time" | "monthly"
  /** Rounded down so we never promise more credits per dollar than purchased. */
  creditsPerDollar: number
  /** The better-value option that still covers the shortfall. */
  recommended: boolean
}

export interface UpgradeAdvice {
  /** What the interrupted action costs, or null when we could not tell. */
  required: number | null
  available: number
  shortfall: number
  /** False when `required` is unknown, so the UI must not state a shortfall. */
  costKnown: boolean
  /** False when even the largest option leaves them short — the UI must not
   * imply that one purchase is enough. */
  anyOptionCovers: boolean
  options: UpgradeOption[]
}

export interface UpgradeInput {
  required: number | null
  available: number
  plans: readonly SubscriptionPlan[]
  packs: readonly PermanentCreditPack[]
}

const MAX_CREDITS = 100_000_000

function cleanCredits(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(MAX_CREDITS, Math.round(value)))
}

/** Parse the `?required=` hint. Anything unusable means "we don't know the cost". */
export function parseRequiredCredits(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[,_\s]/g, "")
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return cleanCredits(value)
}

export function adviseUpgrade({ required, available, plans, packs }: UpgradeInput): UpgradeAdvice {
  const avail = cleanCredits(available)
  const need = required === null ? null : cleanCredits(required)
  const shortfall = need === null ? 0 : Math.max(0, need - avail)

  const sortedPacks = [...packs].sort((a, b) => a.priceUSD - b.priceUSD)
  // Only purchasable plans: active, priced, and granting credits each period.
  const sortedPlans = plans
    .filter((plan) => plan.active && !plan.custom && plan.priceUSD > 0 && plan.mirrorCredits > 0)
    .sort((a, b) => a.priceUSD - b.priceUSD)

  const coveringPack = sortedPacks.find((pack) => pack.credits >= shortfall)
  const coveringPlan = sortedPlans.find((plan) => plan.mirrorCredits >= shortfall)

  const options: UpgradeOption[] = []

  const pack = coveringPack ?? sortedPacks[0]
  if (pack) {
    options.push(toOption("pack", pack.id, pack.label, pack.credits, pack.priceUSD, "one-time"))
  }

  const plan = coveringPlan ?? sortedPlans[0]
  if (plan) {
    options.push(
      toOption("plan", plan.id, plan.name, plan.mirrorCredits, plan.priceUSD, "monthly"),
    )
  }

  // Only recommend an option that actually closes the gap — a "best value"
  // badge on something too small would be a lie.
  if (shortfall > 0) {
    const covering = options.filter((option) => option.credits >= shortfall)
    if (covering.length > 0) {
      let best = covering[0]
      for (const option of covering) {
        if (option.creditsPerDollar > best.creditsPerDollar) best = option
      }
      best.recommended = true
    }
  }

  const anyOptionCovers = shortfall === 0 || options.some((option) => option.credits >= shortfall)

  return {
    required: need,
    available: avail,
    shortfall,
    costKnown: need !== null,
    anyOptionCovers,
    options,
  }
}

function toOption(
  kind: UpgradeKind,
  productId: string,
  title: string,
  credits: number,
  priceUSD: number,
  cadence: UpgradeOption["cadence"],
): UpgradeOption {
  return {
    kind,
    productId,
    title,
    credits: cleanCredits(credits),
    priceUSD,
    cadence,
    creditsPerDollar: priceUSD > 0 ? Math.floor(cleanCredits(credits) / priceUSD) : 0,
    recommended: false,
  }
}
