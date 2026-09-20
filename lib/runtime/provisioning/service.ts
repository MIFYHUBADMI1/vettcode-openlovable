import "server-only"
import { store } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { createApiKey, revokeApiKey } from "@/lib/runtime/keys/service"
import { isTotalumConfigured, createSecret } from "@/lib/integrations/totalum/service"
import { TotalumError } from "@/lib/integrations/totalum/errors"
import { getAppUrl } from "@/lib/env"
import type {
  CapabilityScope,
  RuntimeEnvironment,
} from "@/runtime/contracts/capabilities"
import type { MirrorProject } from "@/lib/types/project"
import type {
  RuntimeProvisioningStatus,
  RuntimeProvisioningRecord,
} from "./types"

/**
 * Atai Runtime — automatic provisioning for generated applications (Phase 8, server-only).
 *
 * ONE authoritative provisioning workflow. It closes the loop:
 *
 *   Atai project (existing lifecycle) → runtime API key (existing Phase 3
 *   key service) → generated application's secure secret store (existing
 *   Totalum secrets mechanism) → @atai/sdk → Runtime API.
 *
 * SECURITY MODEL (verified by tests):
 *   - The plaintext runtime key is created here, injected into the generated
 *     app's secret store, and then DISCARDED. It is never persisted in Atai's
 *     MongoDB (api_keys stores only the SHA-256 hash — Phase 3 invariant
 *     preserved), never logged, never returned from any API response, and
 *     never written into project documents, events, or build summaries.
 *   - The generated application receives ONLY its own project-scoped runtime
 *     credential. Provider credentials (OPENROUTER_API_KEY) and internal
 *     credentials (ATAI_INTERNAL_KEY) never enter the generated app.
 *   - Identity derives SERVER-SIDE from the existing project record
 *     (project.userId) — never from client input. Provisioning is invoked
 *     exclusively from authorized Atai lifecycle code paths.
 *
 * IDEMPOTENCY / FAILURE MODEL (Phase 8 §17/§37/§39/§61):
 *   - Key plaintext cannot be recovered once discarded (hash-only storage).
 *     Therefore key creation and secret injection happen back-to-back: if the
 *     Totalum write fails, the freshly created key is REVOKED immediately —
 *     no orphaned active credentials. The retry creates a fresh key.
 *   - Concurrency is serialized by an atomic claim on the project's
 *     provisioning record (store.claimRuntimeProvisioning — one
 *     findOneAndUpdate transition, no new unique index on api_keys, which
 *     intentionally supports multiple legitimate keys per project).
 *   - A crash between key creation and completion is recovered on the next
 *     call: the recorded apiKeyId is validated (active → reuse + re-inject;
 *     revoked/expired/missing → cleared + fresh provision). No uncontrolled
 *     key duplication.
 *
 * PHASE BOUNDARY: no billing, no credit deduction, no runtime_usage writes,
 * no provider logic (OpenRouter stays behind the Runtime API), no new
 * providers, no build-pipeline rewrite. Provisioning only knows about Atai
 * runtime credentials, project environments, and secret configuration.
 *
 * @module lib/runtime/provisioning/service
 */

// ─── Configuration (single canonical vocabulary) ───────────────────────────

/**
 * The ONE canonical secret name inside the generated application. Matches
 * the @atai/sdk documentation contract (`process.env.ATAI_API_KEY`). No
 * aliases are created (Phase 8 §40).
 */
export const ATAI_RUNTIME_SECRET_NAME = "ATAI_API_KEY" as const

/**
 * Scopes granted to an auto-provisioned generated-application key. LEAST
 * PRIVILEGE: the runtime currently exposes exactly one routed capability
 * (ai.text → chat), so the key gets exactly that — never "*" (empty scopes
 * = all capabilities, which manual dashboard keys may use but automatic
 * provisioning must not).
 */
export const PROVISIONED_KEY_SCOPES: readonly CapabilityScope[] = ["ai.text"] as const

/**
 * The deterministic environment mapping (Phase 8 §101):
 *
 *   build completion (Totalum development preview) → "development"
 *   production deployment (Totalum deploy success) → "production"
 *
 * Totalum projects carry one secret store; its `environment` field mirrors
 * this value so the generated runtime configuration is unambiguous.
 */
export function environmentForLifecycle(
  lifecycle: "development" | "production",
): RuntimeEnvironment {
  return lifecycle === "production" ? "production" : "development"
}

/** Stable, non-secret display name for auto-provisioned keys. */
export function provisionedKeyName(environment: RuntimeEnvironment): string {
  return `Generated application (${environment})`
}

/**
 * The runtime origin handed to the generated application alongside its key.
 * Resolved from the existing deployment configuration — never invented and
 * never hard-coded to a provider or unrelated domain (Phase 8 §24/§25).
 */
export function runtimeBaseUrl(): string {
  return getAppUrl()
}

// ─── Errors ────────────────────────────────────────────────────────────────

export type ProvisioningFailureReason =
  | "NO_GENERATED_APP"
  | "TOTALUM_NOT_CONFIGURED"
  | "KEY_CREATION_FAILED"
  | "SECRET_INJECTION_FAILED"
  | "PROVISIONING_CLAIMED"

export class RuntimeProvisioningError extends Error {
  readonly reason: ProvisioningFailureReason
  constructor(reason: ProvisioningFailureReason, message: string) {
    super(message)
    this.name = "RuntimeProvisioningError"
    this.reason = reason
  }
}

// ─── Provisioning workflow ─────────────────────────────────────────────────

export interface EnsureProvisionedResult {
  /** One of the stable provisioning statuses (types.ts). */
  status: RuntimeProvisioningStatus
  /** Non-secret key reference (rkey_...) when a key is part of the outcome. */
  apiKeyId?: string
  /** Non-secret display prefix — safe for events/admin metadata. */
  keyPrefix?: string
  /** True when an existing valid credential was reused (idempotent call). */
  reused: boolean
}

/**
 * Ensure a project's generated application holds a working runtime credential
 * for `environment`. Safe to call any number of times, from any lifecycle
 * hook, concurrently — exactly one active provisioned key per
 * (project, environment) results.
 *
 * The plaintext secret never escapes this module: it is consumed immediately
 * by the Totalum secret injection below.
 */
export async function ensureRuntimeProvisioned(
  project: MirrorProject,
  environment: RuntimeEnvironment,
): Promise<EnsureProvisionedResult> {
  const projectId = project.id

  // Guard 1 — provisioning targets a GENERATED application. A project
  // without a Totalum project has nothing to configure (Phase 8 §9: never
  // create credentials for projects that never become usable).
  if (!project.totalumProjectId) {
    throw new RuntimeProvisioningError(
      "NO_GENERATED_APP",
      "Project has no generated application to provision.",
    )
  }

  // Guard 2 — the Totalum integration is the existing secret-injection
  // mechanism. Without it there is no safe delivery path (fail loudly rather
  // than create an undeliverable credential).
  if (!isTotalumConfigured()) {
    throw new RuntimeProvisioningError(
      "TOTALUM_NOT_CONFIGURED",
      "The secret store for generated applications is not connected.",
    )
  }

  // 1. Idempotent fast path — a completed record with a live key reuses it.
  const existing = await findValidExistingKey(projectId, environment)
  if (existing) {
    logger.info("runtime.provisioning", "existing provisioned key reused", {
      projectId,
      environment,
      apiKeyId: existing.id,
    })
    return {
      status: "READY",
      apiKeyId: existing.id,
      keyPrefix: existing.keyPrefix,
      reused: true,
    }
  }

  // 2. Atomic claim — serializes concurrent/retried provisioning for this
  //    (project, environment) with ONE document transition (no global lock,
  //    no inappropriate unique index on api_keys).
  const claimed = await store.claimRuntimeProvisioning(projectId, environment)
  if (!claimed) {
    // Another worker holds the claim: let its outcome settle. A short wait
    // then re-check the fast path; if it is still not ready, report the
    // contention honestly instead of racing it.
    const settled = await findValidExistingKey(projectId, environment)
    if (settled) {
      return {
        status: "READY",
        apiKeyId: settled.id,
        keyPrefix: settled.keyPrefix,
        reused: true,
      }
    }
    logger.warn("runtime.provisioning", "provisioning already in progress", {
      projectId,
      environment,
    })
    return { status: "PROVISIONING", reused: false }
  }

  // 3. Critical section — create the key, inject the secret, finalize.
  try {
    // 3a. Orphan cleanup: a crash between key creation and READY leaves a
    //     created-but-never-delivered key. It must not remain active once we
    //     provision a replacement (Phase 8 §37/§39/§62).
    const prior = await store.getRuntimeProvisioning(projectId, environment)
    if (prior?.apiKeyId) {
      try {
        const revoked = await revokeApiKey(project.userId, prior.apiKeyId, "provisioning_retry_replaced")
        if (revoked) {
          logger.info("runtime.provisioning", "incomplete prior provisioned key revoked", {
            projectId,
            environment,
            apiKeyId: prior.apiKeyId,
          })
        }
      } catch (revokeError) {
        logger.warn("runtime.provisioning", "prior-key revocation failed (continuing)", {
          projectId,
          environment,
          apiKeyId: prior.apiKeyId,
          message: revokeError instanceof Error ? revokeError.message : String(revokeError),
        })
      }
      // The prior credential is retired — the record must not keep pointing
      // at it, or the catch-block containment below could misattribute it.
      await store.updateRuntimeProvisioning(projectId, environment, {
        apiKeyId: undefined,
        keyPrefix: undefined,
      })
    }

    const created = await createApiKey(project.userId, {
      projectId,
      environment,
      scopes: [...PROVISIONED_KEY_SCOPES],
      name: provisionedKeyName(environment),
    })

    // Record the key reference BEFORE injection: a crash after this write
    // leaves a recoverable record (validate-or-replace on retry), not an
    // undiscoverable orphan.
    await store.updateRuntimeProvisioning(projectId, environment, {
      status: "KEY_CREATED",
      apiKeyId: created.id,
      keyPrefix: created.keyPrefix,
    })

    // 4. Deliver the plaintext through the EXISTING Totalum secrets
    //    mechanism (create-or-update semantics — retries are safe). One
    //    canonical secret name; values are write-only in Totalum (never
    //    readable back through the API).
    await createSecret(project.totalumProjectId, {
      secretName: ATAI_RUNTIME_SECRET_NAME,
      secretValue: created.secret,
      environment,
    })
    // `created.secret` dies here — nothing below ever references it again.

    // 5. Finalize.
    await store.updateRuntimeProvisioning(projectId, environment, {
      status: "READY",
      provisionedAt: Date.now(),
      claimedAt: undefined,
      error: undefined,
    })
    await store.appendEvent(projectId, {
      id: `evt_${cryptoProvisioningId()}`,
      at: Date.now(),
      level: "info",
      stage: "runtime",
      message: `Runtime provisioned (${environment}) — your app can now use Atai AI.`,
    })

    logger.info("runtime.provisioning", "runtime provisioning complete", {
      projectId,
      environment,
      apiKeyId: created.id,
    })

    return {
      status: "READY",
      apiKeyId: created.id,
      keyPrefix: created.keyPrefix,
      reused: false,
    }
  } catch (e) {
    // 6. Failure containment — the plaintext of a created-but-undelivered
    //    key is unrecoverable by design, so an orphan is prevented by
    //    revoking the key immediately (best-effort) and recording the
    //    failure. The retry path provisions a fresh key. Never silently
    //    report the application as ready (Phase 8 §36/§62).
    const reason: ProvisioningFailureReason =
      e instanceof TotalumError ? "SECRET_INJECTION_FAILED" : "KEY_CREATION_FAILED"

    // Containment rule: after step 3a cleared prior references, an apiKeyId on
    // the record can only be THIS attempt's key (persisted at KEY_CREATED).
    // It was therefore created but never delivered — revoke it regardless of
    // which operation threw (Phase 8 §61/§62: no orphaned active credentials).
    const record = await store.getRuntimeProvisioning(projectId, environment)
    if (record?.apiKeyId) {
      try {
        await revokeApiKey(project.userId, record.apiKeyId, "provisioning_failed_undelivered")
        logger.info("runtime.provisioning", "undeliverable key revoked (orphan prevention)", {
          projectId,
          environment,
          apiKeyId: record.apiKeyId,
        })
      } catch (revokeError) {
        // Revocation is best-effort containment; the failure record below
        // still names the key so a later recovery pass can retire it.
        logger.error("runtime.provisioning", "orphan-key revocation failed", {
          projectId,
          environment,
          apiKeyId: record.apiKeyId,
          message: revokeError instanceof Error ? revokeError.message : String(revokeError),
        })
      }
    }

    await store.updateRuntimeProvisioning(projectId, environment, {
      status: "FAILED",
      claimedAt: undefined,
      error: reason,
    })

    // Log the reason only — never the error chain in full (Totalum errors
    // could echo request context; no secret is ever involved, but hygiene
    // keeps this module leak-free, Phase 8 §42).
    logger.error("runtime.provisioning", "runtime provisioning failed", {
      projectId,
      environment,
      reason,
    })

    throw new RuntimeProvisioningError(
      reason,
      "Runtime credential provisioning failed. It is safe to retry.",
    )
  }
}

// ─── Recovery helpers (crash-safe retry semantics) ─────────────────────────

interface ValidKeyInfo {
  id: string
  keyPrefix: string
}

/**
 * The idempotency lookup. Returns the existing provisioned key ONLY when the
 * recorded credential is still active — i.e. a completed, valid provisioning.
 * Anything else (crash after key creation, failed injection, revoked key)
 * returns null so the caller repairs or re-provisions exactly once.
 *
 * Invariant: no status without an apiKeyId is ever treated as READY, and no
 * revoked/expired key is ever reused.
 */
async function findValidExistingKey(
  projectId: string,
  environment: RuntimeEnvironment,
): Promise<ValidKeyInfo | null> {
  const record = await store.getRuntimeProvisioning(projectId, environment)
  if (!record || record.status !== "READY" || !record.apiKeyId) return null

  const key = await store.findApiKeyMeta(record.apiKeyId)
  if (!key || key.projectId !== projectId || key.environment !== environment) {
    // Record points at a missing/mismatched credential — repair it.
    await store.updateRuntimeProvisioning(projectId, environment, {
      status: "NOT_PROVISIONED",
      apiKeyId: undefined,
      keyPrefix: undefined,
      error: "record_mismatch_repaired",
    })
    return null
  }
  if (key.status !== "active") {
    // The provisioned key was revoked/expired externally — provisioning must
    // produce a fresh credential rather than reuse dead material.
    await store.updateRuntimeProvisioning(projectId, environment, {
      status: "NOT_PROVISIONED",
      apiKeyId: undefined,
      keyPrefix: undefined,
      error: "credential_retired_reprovisioning",
    })
    return null
  }
  return { id: key.id, keyPrefix: key.keyPrefix }
}

// ─── Status (safe metadata only — never secrets) ───────────────────────────

/**
 * Safe provisioning status for admin/UI surfaces. Contains ONLY non-secret
 * metadata (status, key id, prefix, timestamps) — never plaintext, never
 * hashes (Phase 8 §43/§84).
 */
export async function getProvisioningStatus(
  projectId: string,
  environment: RuntimeEnvironment,
): Promise<RuntimeProvisioningRecord | null> {
  return store.getRuntimeProvisioning(projectId, environment)
}

// ─── Internal ──────────────────────────────────────────────────────────────

/** Local id generator for provisioning events (no secrets, correlation only). */
function cryptoProvisioningId(): string {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, "") ?? `${Date.now()}${Math.floor(Math.random() * 1e9)}`
}
