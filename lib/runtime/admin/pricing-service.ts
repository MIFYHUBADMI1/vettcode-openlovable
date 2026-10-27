import "server-only"
import { z } from "zod"
import {
  getRuntimePricingRules,
  updateRuntimePricingRules,
  RUNTIME_PRICING_MODES,
  type RuntimePricingMode,
  type RuntimePricingRule,
} from "@/lib/billing/runtime-config"
import { listProviders, resolveProviderAdapter } from "@/lib/runtime/router/provider-registry"
import { getCapability, listCapabilities } from "@/lib/runtime/router/capability-registry"
import { resolveRuntimePrice } from "@/lib/runtime/metering/resolver"
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

// ─── Bulk configuration (matrix view + one-write apply) ──────────────────────

/** One capability+operation cell: what the admin needs to price it in one go. */
export interface PricingMatrixEntry {
  capability: string
  operation: string
  /**
   * The provider the LIVE registry resolves for this pair — the admin never
   * picks a provider by hand, this is the auto-preset. Null when unwired.
   */
  provider: string | null
  /** Is a production adapter registered for this pair? */
  wired: boolean
  /** Mode the form preselects (from the current effective price). */
  suggestedMode: RuntimePricingMode
  /** What the resolver would charge for this operation RIGHT NOW. */
  effective: {
    source: "rule" | "legacy" | "unconfigured" | "non_billable"
    mode?: RuntimePricingMode
    credits?: number
    inputPer1k?: number
    outputPer1k?: number
    ruleId?: string
  }
  /** The admin rule covering this triple (active OR deactivated). */
  rule: {
    id: string
    active: boolean
    mode: RuntimePricingMode
    credits?: number
    inputPer1k?: number
    outputPer1k?: number
  } | null
}

/**
 * Full pricing matrix: every registered capability × operation, with the
 * provider auto-resolved and the currently-effective price read from the SAME
 * resolution path the runtime uses (resolveRuntimePrice) — so the admin UI can
 * never drift from what billing actually does, and gaps ("would be denied")
 * are visible instead of guessed at.
 */
export async function buildPricingMatrix(): Promise<PricingMatrixEntry[]> {
  const rules = await getRuntimePricingRules()
  const out: PricingMatrixEntry[] = []

  for (const cap of listCapabilities()) {
    for (const operation of cap.operations) {
      const provider = resolveProviderAdapter(cap.id, operation)?.provider ?? null
      const covering = rules.filter(
        (r) => r.capability === cap.id && r.operation === operation && (provider === null || r.provider === provider),
      )
      const activeRule = covering.find((r) => r.active) ?? null

      let effective: PricingMatrixEntry["effective"] = { source: "unconfigured" }
      try {
        const decision = await resolveRuntimePrice({
          provider: provider ?? "unwired",
          capability: cap.id,
          operation,
        })
        effective = decision.chargeable
          ? {
              source: decision.source === "rule" ? "rule" : "legacy",
              mode: decision.snapshot.mode ?? "fixed_per_request",
              ...(decision.fixedCredits !== undefined ? { credits: decision.fixedCredits } : {}),
              ...(decision.inputPer1k !== undefined ? { inputPer1k: decision.inputPer1k } : {}),
              ...(decision.outputPer1k !== undefined ? { outputPer1k: decision.outputPer1k } : {}),
              ...(decision.pricingRuleId !== undefined ? { ruleId: decision.pricingRuleId } : {}),
            }
          : { source: "non_billable" }
      } catch {
        // RuntimePricingUnconfiguredError — the honest answer is "no price yet".
        effective = { source: "unconfigured" }
      }

      const ruleSummary = activeRule
        ? {
            id: activeRule.id,
            active: activeRule.active,
            mode: activeRule.mode,
            ...(activeRule.credits !== undefined ? { credits: activeRule.credits } : {}),
            ...(activeRule.inputPer1k !== undefined ? { inputPer1k: activeRule.inputPer1k } : {}),
            ...(activeRule.outputPer1k !== undefined ? { outputPer1k: activeRule.outputPer1k } : {}),
          }
        : covering[0]
          ? {
              id: covering[0].id,
              active: covering[0].active,
              mode: covering[0].mode,
              ...(covering[0].credits !== undefined ? { credits: covering[0].credits } : {}),
              ...(covering[0].inputPer1k !== undefined ? { inputPer1k: covering[0].inputPer1k } : {}),
              ...(covering[0].outputPer1k !== undefined ? { outputPer1k: covering[0].outputPer1k } : {}),
            }
          : null

      out.push({
        capability: cap.id,
        operation,
        provider,
        wired: provider !== null,
        suggestedMode: effective.mode ?? "fixed_per_request",
        effective,
        rule: ruleSummary,
      })
    }
  }
  return out
}

/** Upper bound on one bulk request; keeps a stray payload from thrashing config. */
export const MAX_BULK_PRICING_RULES = 200

/** Hard cap on stored rules (mirrors the app_settings schema in runtime-config). */
const MAX_STORED_PRICING_RULES = 500

const BulkRuleSpecSchema = z
  .object({
    provider: z.string().min(1).max(64),
    capability: z.string().min(1).max(100),
    operation: z.string().min(1).max(100),
    mode: z.enum(RUNTIME_PRICING_MODES),
    credits: z.number().int().min(0).max(1_000_000).optional(),
    inputPer1k: z.number().int().min(0).max(1_000_000).optional(),
    outputPer1k: z.number().int().min(0).max(1_000_000).optional(),
    active: z.boolean().optional(),
  })
  .strict()

const BulkInputSchema = z
  .object({ rules: z.array(BulkRuleSpecSchema).min(1).max(MAX_BULK_PRICING_RULES) })
  .strict()

export type BulkPricingSpec = z.infer<typeof BulkRuleSpecSchema>

export function parseBulkRuleInput(body: unknown):
  | { ok: true; data: { rules: BulkPricingSpec[] } }
  | { ok: false; error: string } {
  const parsed = BulkInputSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bulk pricing payload." }
  }
  return { ok: true, data: parsed.data }
}

/** Per-row outcome reported back to the admin UI. */
export interface BulkPricingRowResult {
  capability: string
  operation: string
  provider: string
  outcome: "created" | "updated" | "unchanged" | "rejected"
  error?: string
}

export interface BulkPricingResult {
  created: number
  updated: number
  unchanged: number
  rejected: number
  rows: BulkPricingRowResult[]
}

/** Rates identical? Used to skip no-op writes (keeps updatedAt + audit clean). */
function sameRates(a: RuntimePricingRule, b: BulkPricingSpec): boolean {
  if (a.mode !== b.mode) return false
  if (b.mode === "fixed_per_request") return (a.credits ?? 0) === (b.credits ?? 0)
  return (a.inputPer1k ?? 0) === (b.inputPer1k ?? 0) && (a.outputPer1k ?? 0) === (b.outputPer1k ?? 0)
}

/**
 * Apply many pricing rules in ONE configuration write.
 *
 * Upsert semantics: an active rule for provider+capability+operation has its
 * RATES updated (mode and identity stay immutable — same rule as the single
 * PATCH path, §11/§41); a deactivated rule is edited but never silently
 * re-enabled; anything else creates a new rule. Every spec is validated
 * against the live registries first, so a bad row is rejected individually
 * instead of aborting (or half-applying) the batch.
 *
 * One read + one atomic array replacement means N rules cost one write and
 * cannot interleave with a concurrent writer the way N sequential POSTs
 * would (each of which re-reads then replaces the whole document).
 */
export async function bulkUpsertAdminRuntimePricingRules(params: {
  adminId: string
  specs: readonly BulkPricingSpec[]
}): Promise<BulkPricingResult> {
  const rules = await getRuntimePricingRules()
  const next: RuntimePricingRule[] = rules.map((r) => ({ ...r }))
  const rows: BulkPricingRowResult[] = []
  const touched: { before: RuntimePricingRule | null; after: RuntimePricingRule }[] = []
  const seenTriples = new Set<string>()

  for (const spec of params.specs) {
    const triple = `${spec.provider}/${spec.capability}/${spec.operation}`
    const label = { capability: spec.capability, operation: spec.operation, provider: spec.provider }

    if (seenTriples.has(triple)) {
      rows.push({ ...label, outcome: "rejected", error: "Duplicate row in this request." })
      continue
    }
    seenTriples.add(triple)

    const rateError = validateModeRates(spec)
    if (rateError) {
      rows.push({ ...label, outcome: "rejected", error: rateError })
      continue
    }
    const registryError = validateAgainstRegistries(spec)
    if (registryError) {
      rows.push({ ...label, outcome: "rejected", error: registryError })
      continue
    }

    const index = next.findIndex(
      (r) => r.provider === spec.provider && r.capability === spec.capability && r.operation === spec.operation,
    )

    if (index === -1) {
      if (next.length >= MAX_STORED_PRICING_RULES) {
        rows.push({ ...label, outcome: "rejected", error: `Rule cap (${MAX_STORED_PRICING_RULES}) reached.` })
        continue
      }
      const now = Date.now()
      const created: RuntimePricingRule = {
        id: newRuleId(),
        provider: spec.provider,
        capability: spec.capability,
        operation: spec.operation,
        mode: spec.mode,
        ...(spec.mode === "fixed_per_request"
          ? { credits: spec.credits ?? 0 }
          : { inputPer1k: spec.inputPer1k ?? 0, outputPer1k: spec.outputPer1k ?? 0 }),
        active: spec.active ?? true,
        createdBy: params.adminId,
        createdAt: now,
        updatedAt: now,
      }
      next.push(created)
      touched.push({ before: null, after: created })
      rows.push({ ...label, outcome: "created" })
      continue
    }

    const existing = next[index]
    if (existing.active && spec.mode !== existing.mode) {
      rows.push({
        ...label,
        outcome: "rejected",
        error: `Mode is immutable on an active rule (${existing.mode}). Deactivate it first, then set the new mode.`,
      })
      continue
    }
    const noChange =
      sameRates(existing, spec) && (spec.active === undefined || spec.active === existing.active)
    if (noChange) {
      rows.push({ ...label, outcome: "unchanged" })
      continue
    }

    const updated: RuntimePricingRule = {
      ...existing,
      mode: spec.mode,
      ...(spec.mode === "fixed_per_request"
        ? { credits: spec.credits ?? 0, inputPer1k: undefined, outputPer1k: undefined }
        : { inputPer1k: spec.inputPer1k ?? 0, outputPer1k: spec.outputPer1k ?? 0, credits: undefined }),
      ...(spec.active !== undefined ? { active: spec.active } : {}),
      updatedAt: Date.now(),
    }
    // Strip the undefined rate keys so the persisted doc carries only the
    // fields its mode actually uses.
    for (const key of ["credits", "inputPer1k", "outputPer1k"] as const) {
      if (updated[key] === undefined) delete updated[key]
    }
    next[index] = updated
    touched.push({ before: existing, after: updated })
    rows.push({ ...label, outcome: "updated" })
  }

  const counts = {
    created: rows.filter((r) => r.outcome === "created").length,
    updated: rows.filter((r) => r.outcome === "updated").length,
    unchanged: rows.filter((r) => r.outcome === "unchanged").length,
    rejected: rows.filter((r) => r.outcome === "rejected").length,
  }

  if (touched.length > 0) {
    await updateRuntimePricingRules(next)
    for (const change of touched) {
      auditPricingChange({
        adminId: params.adminId,
        action: change.before === null ? "runtime_pricing_rule_created" : "runtime_pricing_rule_updated",
        rule: change.after,
        ...(change.before === null
          ? {}
          : {
              changes: {
                bulk: true,
                ...("credits" in change.after || "credits" in change.before
                  ? { credits: { from: change.before.credits, to: change.after.credits } }
                  : {}),
                ...("inputPer1k" in change.after || "inputPer1k" in change.before
                  ? { inputPer1k: { from: change.before.inputPer1k, to: change.after.inputPer1k } }
                  : {}),
                ...("outputPer1k" in change.after || "outputPer1k" in change.before
                  ? { outputPer1k: { from: change.before.outputPer1k, to: change.after.outputPer1k } }
                  : {}),
              },
            }),
      })
    }
    logger.info("runtime.admin.pricing", "bulk runtime pricing applied", {
      adminId: params.adminId,
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      rejected: counts.rejected,
    })
  }

  return { ...counts, rows }
}
