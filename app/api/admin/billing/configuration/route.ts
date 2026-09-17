import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { z } from "zod"
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
import {
  getCollaborateCosts,
  updateCollaborateCosts,
  DEFAULT_COLLABORATE_COSTS,
  invalidateBillingSettings,
} from "@/lib/billing/runtime-config"
import { logger } from "@/lib/logging/logger"

export async function GET() {
  try {
    await requireAdmin()

    const collaborateCosts = await getCollaborateCosts()

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
        creditUnit: "Atai Credits",
        welcomeBonusCredits: WELCOME_BONUS_CREDITS,
        referralVerificationReward: REFERRAL_VERIFICATION_REWARD,
        referralMilestoneReward: REFERRAL_MILESTONE_REWARD,
        referralMilestoneThreshold: REFERRAL_MILESTONE_THRESHOLD,
      },

      // ── Collaborate AI Co-Founder (runtime-configurable) ──
      collaborateCosts: {
        chatMessageCost: collaborateCosts.chatMessageCost,
        planAnalysisCost: collaborateCosts.planAnalysisCost,
        defaults: DEFAULT_COLLABORATE_COSTS,
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
        AtaiCreditsPerBaselineUnit: CREDITS_PER_BASELINE_UNIT,
        description: `1 baseline cost unit = ${CREDITS_PER_BASELINE_UNIT.toLocaleString()} Atai Credits`,
      },
    }

    return ok(configuration)
  } catch (e) {
    return handleRouteError("api.admin.billing.configuration", e)
  }
}

/**
 * PATCH /api/admin/billing/configuration
 *
 * Update runtime-configurable billing settings. Currently supports the
 * Collaborate AI costs; unknown fields are rejected so typos fail loudly
 * instead of silently doing nothing.
 */
const PatchSchema = z.object({
  collaborate: z
    .object({
      chatMessageCost: z.number().int().min(0).max(10_000).optional(),
      planAnalysisCost: z.number().int().min(0).max(100_000).optional(),
    })
    .optional(),
})

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin()

    const body = (await req.json().catch(() => null)) as unknown
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return fail("VALIDATION", "Invalid configuration values.", 422)
    }
    if (!parsed.data.collaborate) {
      return fail("VALIDATION", "No configuration changes provided.", 422)
    }

    const updated = await updateCollaborateCosts(parsed.data.collaborate)
    invalidateBillingSettings()

    logger.info("api.admin.billing.configuration", "collaborate costs updated", {
      adminId: admin.id,
      costs: updated,
    })

    return ok({ collaborateCosts: updated })
  } catch (e) {
    return handleRouteError("api.admin.billing.configuration", e)
  }
}
