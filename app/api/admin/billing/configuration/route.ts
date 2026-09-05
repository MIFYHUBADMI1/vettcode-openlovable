import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import {
  PERMANENT_CREDIT_PACKS,
  BUILD_TIERS,
  SUBSCRIPTION_PLANS,
  DEFAULT_BILLING_CURRENCY,
  WELCOME_BONUS_CREDITS,
  REFERRAL_VERIFICATION_REWARD,
  REFERRAL_MILESTONE_REWARD,
  REFERRAL_MILESTONE_THRESHOLD,
  CREDITS_PER_BASELINE_UNIT,
  BASELINE_COST_MODEL_V1,
} from "@/lib/billing/config"

export async function GET() {
  try {
    await requireAdmin()

    const configuration = {
      // ── Currency ──
      currency: DEFAULT_BILLING_CURRENCY,

      // ── Permanent Credit Packs (USD) ──
      permanentCreditPacks: PERMANENT_CREDIT_PACKS.map((pack) => ({
        id: pack.id,
        credits: pack.credits,
        priceUSD: pack.priceUSD,
        pricePerCredit: pack.priceUSD / pack.credits,
        label: pack.label,
        popular: pack.popular ?? false,
      })),

      // ── Application Build Tiers ──
      applicationTiers: Object.entries(BUILD_TIERS).map(([key, tier]) => ({
        id: key,
        credits: tier.credits,
        label: tier.label,
        description: tier.description,
      })),

      // ── System Config ──
      systemConfig: {
        currency: DEFAULT_BILLING_CURRENCY,
        creditUnit: "MirrorSite Credits",
        welcomeBonusCredits: WELCOME_BONUS_CREDITS,
        referralVerificationReward: REFERRAL_VERIFICATION_REWARD,
        referralMilestoneReward: REFERRAL_MILESTONE_REWARD,
        referralMilestoneThreshold: REFERRAL_MILESTONE_THRESHOLD,
      },

      // ── Dodo Integration ──
      dodoConfig: {
        apiKeyConfigured: Boolean(process.env.DODO_PAYMENTS_API_KEY),
        webhookKeyConfigured: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY),
        environment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? "not_configured",
      },

      // ── Subscription Plans (USD) ──
      subscriptionPlans: SUBSCRIPTION_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        priceUSD: plan.priceUSD,
        mirrorCredits: plan.mirrorCredits,
        interval: plan.interval,
        active: plan.active,
        custom: plan.custom ?? false,
        popular: plan.popular ?? false,
        features: plan.features,
        notIncluded: plan.notIncluded ?? [],
      })),

      // ── Internal Baseline Cost Model (Admin Only) ──
      baselineCostModel: {
        version: BASELINE_COST_MODEL_V1.version,
        tiers: BASELINE_COST_MODEL_V1.tiers,
        creditsPerBaselineUnit: CREDITS_PER_BASELINE_UNIT,
      },

      // ── Conversion Rate ──
      conversionRate: {
        mirrorsiteCreditsPerBaselineUnit: CREDITS_PER_BASELINE_UNIT,
        description: `1 baseline cost unit = ${CREDITS_PER_BASELINE_UNIT.toLocaleString()} MirrorSite Credits`,
      },
    }

    return ok(configuration)
  } catch (e) {
    return handleRouteError("api.admin.billing.configuration", e)
  }
}
