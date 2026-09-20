import "server-only"
import { z } from "zod"
import {
  getRuntimePricingRules,
  updateRuntimePricingRules,
  type RuntimePricingRule,
} from "@/lib/billing/runtime-config"
import { listProviders } from "@/lib/runtime/router/provider-registry"
import { getCapability } from "@/lib/runtime/router/capability-registry"
import { logger } from "@/lib/logging/logger"
import { logAuditAction } from "@/lib/infrastructure/audit"

/**
 * Atai Runtime — admin runtime pricing service (server-only, Phase 9.5).
 *
 * CRUD for ADMIN-MANAGED runtime pricing rules, stored in the existing
 * app_settings billing document (no second config store, no migration).
 * One authoritative write path; the admin API routes delegate here.
 *
 * Server-side validation is AUTHORITATIVE (Phase 9.5 §34): the admin UI can
 * pre-check, but only this service decides what is a valid rule.
 *
 * Deactivation over deletion (§11): rules are disabled (active=false) rather
 * than removed, preserving the pricing-rule audit trail. Historical runtime
 * charges snapshot the resolved pricing at request time, so deactivation or
 * edits never rewrite the past (§12/§41/§76).
 *
 * @module lib/runtime/admin/pricing-service
 */

const CreateRuleSchema = z
  .object({
    provider: z.string().min(1).max(64),
    capability: z.string().min(1).max(100),
    operation: z.string().min(1).max(100),
    mode: z.enum(["fixed_per_request", "per_1k_tokens"]),
    credits: z.number().int().min(0).max(1_000_000).optional(),
    inputPer1k: z.number().int().min(0).max(1_000_000).optional(),
    outputPer1k: z.number().int().min(0).max(1_000_000).optional(),
    active: z.boolean().optional(),
  })
  .strict()

/** Mode and identity fields are immutable — updates touch rates/status only. */
const UpdateRuleSchema = z
  .object({
    credits: z.number().int().min(0).max(1_000_000).optional(),
    inputPer1k: z.number().int().min(0).max(1_000_000).optional(),
    outputPer1k: z.number().int().min(0).max(1_000_000).optional(),
    active: z.boolean().optional(),
  })
  .strict()

/** Public shape returned to the admin UI (the rule itself — no secrets exist on it). */
export type AdminRuntimePricingRule = RuntimePricingRule

export function parseCreateRuleInput(body: unknown):
  | { ok: true; data: z.infer<typeof CreateRuleSchema> }
  | { ok: false; error: string } {
  const parsed = CreateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid pricing rule." }
  }
  return { ok: true, data: parsed.data }
}

export function parseUpdateRuleInput(body: unknown):
  | { ok: true; data: z.infer<typeof UpdateRuleSchema> }
  | { ok: false; error: string } {
  const parsed = UpdateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid pricing rule update." }
  }
  return { ok: true, data: parsed.data }
}

/**
 * Persist a pricing-change audit record (§40/§60). Financial configuration
 * changes must be traceable — use the EXISTING infrastructure audit
 * collection (no second audit store). Values are the numeric rates/flags
 * only; never secrets. Audit failure never blocks the change itself.
 */
function auditPricingChange(params: {
  adminId: string
  action: string
  rule: RuntimePricingRule
  changes?: Record<string, unknown>
}): void {
  void logAuditAction({
    adminUserId: params.adminId,
    action: params.action,
    userId: params.rule.createdBy,
    result: "success",
    metadata: {
      ruleId: params.rule.id,
      provider: params.rule.provider,
      capability: params.rule.capability,
      operation: params.rule.operation,
      mode: params.rule.mode,
      ...params.changes,
    },
  }) // logAuditAction already swallows + logs internally
}

/** Deterministic rule id (`rpr_<random>`). */
function newRuleId(): string {
  return `rpr_${globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? crypto.randomUUID().replace(/-/g, "")}`
}

/** Validate the rule against the LIVE capability + provider registries. */
function validateAgainstRegistries(rule: {
  provider: string
  capability: string
  operation: string
}): string | null {
  const cap = getCapability(rule.capability)
  if (!cap) return `Unknown capability "${rule.capability}".`
  if (!cap.operations.includes(rule.operation)) {
    return `Operation "${rule.operation}" is not valid for capability "${rule.capability}".`
  }
  const providers = listProviders()
  if (!providers.includes(rule.provider)) {
    return `Unknown provider "${rule.provider}".`
  }
  return null
}

/** Validate mode/rates consistency for one rule payload. */
function validateModeRates(input: {
  mode: "fixed_per_request" | "per_1k_tokens"
  credits?: number
  inputPer1k?: number
  outputPer1k?: number
}): string | null {
  if (input.mode === "fixed_per_request") {
    if (typeof input.credits !== "number") return "Fixed pricing requires a credits value."
    if (input.inputPer1k !== undefined || input.outputPer1k !== undefined) {
      return "Fixed pricing does not accept per-1k-token rates."
    }
    return null
  }
  // per_1k_tokens: rates required; 0/0 is a VALID explicit free rule.
  if (typeof input.inputPer1k !== "number" || typeof input.outputPer1k !== "number") {
    return "Token pricing requires inputPer1k and outputPer1k rates."
  }
  if (input.credits !== undefined) {
    return "Token pricing does not accept a flat credits value."
  }
  return null
}

/** List all pricing rules (admin view). */
export async function listAdminRuntimePricingRules(): Promise<readonly RuntimePricingRule[]> {
  return getRuntimePricingRules()
}

/**
 * Create a pricing rule. Rejects duplicates (an active rule already matching
 * provider+capability+operation — §75) and invalid registry combinations.
 */
export async function createAdminRuntimePricingRule(params: {
  adminId: string
  input: z.infer<typeof CreateRuleSchema>
}): Promise<
  | { ok: true; rule: RuntimePricingRule }
  | { ok: false; error: string; status: number }
> {
  const input = params.input
  const rateError = validateModeRates(input)
  if (rateError) return { ok: false, error: rateError, status: 422 }

  const registryError = validateAgainstRegistries(input)
  if (registryError) return { ok: false, error: registryError, status: 422 }

  const rules = await getRuntimePricingRules()
  if (rules.some((r) => r.active && r.provider === input.provider && r.capability === input.capability && r.operation === input.operation)) {
    return {
      ok: false,
      error: "An active pricing rule already exists for this provider, capability, and operation.",
      status: 409,
    }
  }

  const now = Date.now()
  const rule: RuntimePricingRule = {
    id: newRuleId(),
    provider: input.provider,
    capability: input.capability,
    operation: input.operation,
    mode: input.mode,
    ...(input.mode === "fixed_per_request" ? { credits: input.credits! } : { inputPer1k: input.inputPer1k!, outputPer1k: input.outputPer1k! }),
    active: input.active ?? true,
    createdBy: params.adminId,
    createdAt: now,
    updatedAt: now,
  }

  await updateRuntimePricingRules([...rules, rule])

  auditPricingChange({
    adminId: params.adminId,
    action: "runtime_pricing_rule_created",
    rule,
  })

  logger.info("runtime.admin.pricing", "runtime pricing rule created", {
    adminId: params.adminId,
    ruleId: rule.id,
    provider: rule.provider,
    capability: rule.capability,
    operation: rule.operation,
    mode: rule.mode,
    credits: rule.credits,
    inputPer1k: rule.inputPer1k,
    outputPer1k: rule.outputPer1k,
    active: rule.active,
  })
  return { ok: true, rule }
}

/**
 * Update a pricing rule (rates and/or active flag). Mode and identity fields
 * are immutable — change them by deactivating and creating a new rule, which
 * keeps the pricing history unambiguous (§11/§41).
 */
export async function updateAdminRuntimePricingRule(params: {
  adminId: string
  ruleId: string
  input: z.infer<typeof UpdateRuleSchema>
}): Promise<
  | { ok: true; rule: RuntimePricingRule }
  | { ok: false; error: string; status: number }
> {
  const rules = await getRuntimePricingRules()
  const index = rules.findIndex((r) => r.id === params.ruleId)
  if (index === -1) return { ok: false, error: "Pricing rule not found.", status: 404 }

  const existing = rules[index]
  const mergedMode = existing.mode

  // Validate merged rates.
  const rateError = validateModeRates({
    mode: mergedMode,
    credits: "credits" in params.input ? params.input.credits : existing.credits,
    inputPer1k: "inputPer1k" in params.input ? params.input.inputPer1k : existing.inputPer1k,
    outputPer1k: "outputPer1k" in params.input ? params.input.outputPer1k : existing.outputPer1k,
  })
  if (rateError) return { ok: false, error: rateError, status: 422 }

  const updated: RuntimePricingRule = {
    ...existing,
    ...("credits" in params.input ? { credits: params.input.credits } : {}),
    ...("inputPer1k" in params.input ? { inputPer1k: params.input.inputPer1k } : {}),
    ...("outputPer1k" in params.input ? { outputPer1k: params.input.outputPer1k } : {}),
    ...("active" in params.input ? { active: params.input.active } : {}),
    updatedAt: Date.now(),
  }

  const next = [...rules]
  next[index] = updated
  await updateRuntimePricingRules(next)

  auditPricingChange({
    adminId: params.adminId,
    action: existing.active === false && updated.active === true
      ? "runtime_pricing_rule_activated"
      : existing.active === true && updated.active === false
        ? "runtime_pricing_rule_deactivated"
        : "runtime_pricing_rule_updated",
    rule: updated,
    changes: {
      ...("credits" in params.input ? { credits: { from: existing.credits, to: params.input.credits } } : {}),
      ...("inputPer1k" in params.input ? { inputPer1k: { from: existing.inputPer1k, to: params.input.inputPer1k } } : {}),
      ...("outputPer1k" in params.input ? { outputPer1k: { from: existing.outputPer1k, to: params.input.outputPer1k } } : {}),
      ...("active" in params.input ? { active: { from: existing.active, to: params.input.active } } : {}),
    },
  })

  logger.info("runtime.admin.pricing", "runtime pricing rule updated", {
    adminId: params.adminId,
    ruleId: params.ruleId,
    provider: existing.provider,
    capability: existing.capability,
    operation: existing.operation,
    // Audit trail (§40/§65): old → new values for changed fields only.
    changes: {
      ...("credits" in params.input ? { credits: { from: existing.credits, to: params.input.credits } } : {}),
      ...("inputPer1k" in params.input ? { inputPer1k: { from: existing.inputPer1k, to: params.input.inputPer1k } } : {}),
      ...("outputPer1k" in params.input ? { outputPer1k: { from: existing.outputPer1k, to: params.input.outputPer1k } } : {}),
      ...("active" in params.input ? { active: { from: existing.active, to: params.input.active } } : {}),
    },
  })
  return { ok: true, rule: updated }
}

/**
 * Deactivate (disable) a pricing rule — the preferred "delete" (§11): the
 * rule stays for audit, never matches again, and historical records are
 * untouched. Physical deletion is intentionally NOT offered.
 */
export async function deactivateAdminRuntimePricingRule(params: {
  adminId: string
  ruleId: string
}): Promise<
  | { ok: true; rule: RuntimePricingRule }
  | { ok: false; error: string; status: number }
> {
  return updateAdminRuntimePricingRule({
    adminId: params.adminId,
    ruleId: params.ruleId,
    input: { active: false },
  })
}
