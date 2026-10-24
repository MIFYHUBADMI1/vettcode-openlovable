/**
 * Expected Resources — credit costs.
 *
 * Shared by the resources API routes (server) and the resources UI (client)
 * so the estimate shown before generating and the amount actually charged can
 * never drift apart.
 *
 * This module must stay free of server-only imports (no credit-service, no
 * mongodb). The charging logic lives in ./resources-credits.ts, which imports
 * these values; importing that module from a Client Component pulls
 * "server-only" and the MongoDB driver into the browser bundle.
 */

export const RESOURCES_CREDIT_COSTS = {
  actionPlan: 50,
  marketResearch: 75,
  competitors: 100,
  marketingPlaybook: 75,
} as const

export type ResourcesAIOperation = keyof typeof RESOURCES_CREDIT_COSTS
