import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { z } from "zod"
import {
  PERMANENT_CREDIT_PACKS,
  BUILD_TIERS,
  SUBSCRIPTION_PLANS,
  DEFAULT_BILLING_CURRENCY,
  CREDITS_PER_BASELINE_UNIT,
  BASELINE_COST_MODEL_V1,
} from "@/lib/billing/config"
import {
  getCollaborateCosts,
  getBuildTierCosts,
  getMirrorPipelineCosts,
  getDeploymentCosts,
  getForkPricing,
  getInfrastructurePrices,
  updateBillingSettings,
  DEFAULT_COLLABORATE_COSTS,
  DEFAULT_BUILD_TIER_COSTS,
  DEFAULT_MIRROR_PIPELINE_COSTS,
  DEFAULT_DEPLOYMENT_COSTS,
  DEFAULT_FORK_PRICING,
  DEFAULT_INFRASTRUCTURE_PRICES,
  getRewardSettings,
  DEFAULT_REWARDS,
  getRuntimePricing,
  DEFAULT_RUNTIME_PRICING,
  RUNTIME_PRICING_VERSION,
  invalidateBillingSettings,
} from "@/lib/billing/runtime-config"
import { logger } from "@/lib/logging/logger"

export async function GET() {
  try {
    await requireAdmin()

    const collaborateCosts = await getCollaborateCosts()
    const buildTierCosts = await getBuildTierCosts()
    const mirrorPipelineCosts = await getMirrorPipelineCosts()
    const deploymentCosts = await getDeploymentCosts()
    const forkPricing = await getForkPricing()
    const infrastructurePrices = await getInfrastructurePrices()
    const rewards = await getRewardSettings()
    const runtimePricing = await getRuntimePricing()

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

      // ── System Config (runtime values) ──
      systemConfig: {
        currency: DEFAULT_BILLING_CURRENCY,
        creditUnit: "Atai Credits",
        welcomeBonusCredits: rewards.welcomeBonus,
        referralVerificationReward: rewards.referralVerificationReward,
        referralMilestoneReward: rewards.referralMilestoneReward,
        referralMilestoneThreshold: rewards.referralMilestoneThreshold,
      },

      // ── Collaborate AI Co-Founder (runtime-configurable) ──
      collaborateCosts: {
        chatMessageCost: collaborateCosts.chatMessageCost,
        planAnalysisCost: collaborateCosts.planAnalysisCost,
        autoCompleteSectionCost: collaborateCosts.autoCompleteSectionCost,
        defaults: DEFAULT_COLLABORATE_COSTS,
      },

      // ── Build tier costs (runtime-configurable) ──
      buildTierCosts: {
        simple: buildTierCosts.simple,
        medium: buildTierCosts.medium,
        complex: buildTierCosts.complex,
        defaults: DEFAULT_BUILD_TIER_COSTS,
      },

      // ── Mirror/crawl pipeline costs (runtime-configurable) ──
      mirrorPipelineCosts: {
        scrapeCost: mirrorPipelineCosts.scrapeCost,
        heavyScrapeCost: mirrorPipelineCosts.heavyScrapeCost,
        planCost: mirrorPipelineCosts.planCost,
        heavyPlanCost: mirrorPipelineCosts.heavyPlanCost,
        deepCrawlCost: mirrorPipelineCosts.deepCrawlCost,
        heavyDeepCrawlCost: mirrorPipelineCosts.heavyDeepCrawlCost,
        defaults: DEFAULT_MIRROR_PIPELINE_COSTS,
      },

      // ── Deployment costs (runtime-configurable) ──
      deploymentCosts: {
        deployCost: deploymentCosts.deployCost,
        defaults: DEFAULT_DEPLOYMENT_COSTS,
      },

      // ── Fork pricing (runtime-configurable) ──
      forkPricing: {
        simpleForkCost: forkPricing.simpleForkCost,
        mediumForkCost: forkPricing.mediumForkCost,
        complexForkCost: forkPricing.complexForkCost,
        simpleOwnerRoyalty: forkPricing.simpleOwnerRoyalty,
        mediumOwnerRoyalty: forkPricing.mediumOwnerRoyalty,
        complexOwnerRoyalty: forkPricing.complexOwnerRoyalty,
        defaults: DEFAULT_FORK_PRICING,
      },

      // ── Infrastructure plan prices (runtime-configurable) ──
      infrastructurePrices: {
        basicPrice: infrastructurePrices.basicPrice,
        starterPrice: infrastructurePrices.starterPrice,
        proPrice: infrastructurePrices.proPrice,
        businessPrice: infrastructurePrices.businessPrice,
        defaults: DEFAULT_INFRASTRUCTURE_PRICES,
      },

      // ── Runtime API pricing (runtime-configurable; server-controlled) ──
      runtimePricing: {
        ...runtimePricing,
        defaults: DEFAULT_RUNTIME_PRICING,
        pricingVersion: RUNTIME_PRICING_VERSION,
        unit: "credits per 1,000 tokens (web: flat per request)",
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
      autoCompleteSectionCost: z.number().int().min(0).max(10_000).optional(),
    })
    .optional(),
  buildTiers: z
    .object({
      simple: z.number().int().min(0).max(10_000_000).optional(),
      medium: z.number().int().min(0).max(10_000_000).optional(),
      complex: z.number().int().min(0).max(10_000_000).optional(),
    })
    .optional(),
  mirrorPipeline: z
    .object({
      scrapeCost: z.number().int().min(0).max(100_000).optional(),
      heavyScrapeCost: z.number().int().min(0).max(100_000).optional(),
      heavyPlanCost: z.number().int().min(0).max(100_000).optional(),
      planCost: z.number().int().min(0).max(100_000).optional(),
      deepCrawlCost: z.number().int().min(0).max(1_000_000).optional(),
      heavyDeepCrawlCost: z.number().int().min(0).max(1_000_000).optional(),
    })
    .optional(),
  deployment: z
    .object({
      deployCost: z.number().int().min(0).max(1_000_000).optional(),
    })
    .optional(),
  forkPricing: z
    .object({
      simpleForkCost: z.number().int().min(0).max(10_000_000).optional(),
      mediumForkCost: z.number().int().min(0).max(10_000_000).optional(),
      complexForkCost: z.number().int().min(0).max(10_000_000).optional(),
      simpleOwnerRoyalty: z.number().int().min(0).max(10_000_000).optional(),
      mediumOwnerRoyalty: z.number().int().min(0).max(10_000_000).optional(),
      complexOwnerRoyalty: z.number().int().min(0).max(10_000_000).optional(),
    })
    .optional(),
  infrastructurePrices: z
    .object({
      basicPrice: z.number().int().min(0).max(10_000_000).optional(),
      starterPrice: z.number().int().min(0).max(10_000_000).optional(),
      proPrice: z.number().int().min(0).max(10_000_000).optional(),
      businessPrice: z.number().int().min(0).max(10_000_000).optional(),
    })
    .optional(),
  rewards: z
    .object({
      welcomeBonus: z.number().int().min(0).max(1_000_000).optional(),
      referralVerificationReward: z.number().int().min(0).max(1_000_000).optional(),
      referralMilestoneReward: z.number().int().min(0).max(1_000_000).optional(),
      referralMilestoneThreshold: z.number().int().min(0).max(100_000_000).optional(),
    })
    .optional(),
  runtimePricing: z
    .object({
      aiTextInputPer1k: z.number().int().min(0).max(1_000_000).optional(),
      aiTextOutputPer1k: z.number().int().min(0).max(1_000_000).optional(),
      aiEmbedPer1k: z.number().int().min(0).max(1_000_000).optional(),
      webRequest: z.number().int().min(0).max(1_000_000).optional(),
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
    if (
      !parsed.data.collaborate && !parsed.data.buildTiers && !parsed.data.mirrorPipeline &&
      !parsed.data.deployment && !parsed.data.forkPricing && !parsed.data.infrastructurePrices &&
      !parsed.data.rewards && !parsed.data.runtimePricing
    ) {
      return fail("VALIDATION", "No configuration changes provided.", 422)
    }

    const updated = await updateBillingSettings({
      ...(parsed.data.collaborate ? { collaborate: parsed.data.collaborate } : {}),
      ...(parsed.data.buildTiers ? { buildTiers: parsed.data.buildTiers } : {}),
      ...(parsed.data.mirrorPipeline ? { mirrorPipeline: parsed.data.mirrorPipeline } : {}),
      ...(parsed.data.deployment ? { deployment: parsed.data.deployment } : {}),
      ...(parsed.data.forkPricing ? { forkPricing: parsed.data.forkPricing } : {}),
      ...(parsed.data.infrastructurePrices ? { infrastructurePrices: parsed.data.infrastructurePrices } : {}),
      ...(parsed.data.rewards ? { rewards: parsed.data.rewards } : {}),
      ...(parsed.data.runtimePricing ? { runtimePricing: parsed.data.runtimePricing } : {}),
    })
    invalidateBillingSettings()

    logger.info("api.admin.billing.configuration", "billing settings updated", {
      adminId: admin.id,
      collaborate: updated.collaborate,
      buildTiers: updated.buildTiers,
      mirrorPipeline: updated.mirrorPipeline,
      deployment: updated.deployment,
      forkPricing: updated.forkPricing,
      infrastructurePrices: updated.infrastructurePrices,
      runtimePricing: updated.runtimePricing,
    })

    return ok({
      collaborateCosts: updated.collaborate,
      buildTierCosts: updated.buildTiers,
      mirrorPipelineCosts: updated.mirrorPipeline,
      deploymentCosts: updated.deployment,
      forkPricing: updated.forkPricing,
      infrastructurePrices: updated.infrastructurePrices,
      runtimePricing: updated.runtimePricing,
    })
  } catch (e) {
    return handleRouteError("api.admin.billing.configuration", e)
  }
}
