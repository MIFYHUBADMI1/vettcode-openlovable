import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { isCampaignsEnabledForUser } from "@/lib/marketing/feature-flags"
import {
  createCampaign,
  listCampaigns,
  updateCampaignStatus,
  updateCampaignFields,
  isCampaignStatus,
} from "@/lib/marketing/campaigns/service"
import type { CampaignDoc } from "@/lib/types/db"
import { z } from "zod"

/**
 * Campaigns endpoint (Phase 6 — W5).
 *
 * Session-authenticated, fail-closed ownership (uniform 404 — no existence leak),
 * rate limited on writes, and flag-gated. Campaigns are FREE and PLAN-ONLY —
 * nothing here charges/refunds credits, sends email, posts to social, spends a
 * budget, or runs on a timer (no job substrate exists). GET lists the founder's
 * own campaign plans. POST creates a plan; the client may ONLY stamp origin
 * "user_created" — the "ai_generated" origin is reserved for the approval-gated
 * `propose_campaign` cofounder tool and cannot be forged here. PATCH moves a
 * plan's lifecycle status and/or edits its fields; every change is appended to
 * the plan's durable history by the service. `plannedBudgetCents` is a tracked
 * planning number, never spend.
 */

const ChannelEnum = z.enum(["email", "social", "content", "seo", "referral", "other"])

/** Origins a client is allowed to create. "ai_generated" is intentionally absent. */
const ClientOrigin = z.enum(["user_created"])

const CreateSchema = z
  .object({
    name: z.string().min(3).max(120),
    objective: z.string().max(500).optional(),
    channels: z.array(ChannelEnum).max(6).optional(),
    plannedBudgetCents: z.number().int().min(0).nullable().optional(),
    utmCampaign: z.string().max(64).nullable().optional(),
    startDate: z.number().int().positive().nullable().optional(),
    endDate: z.number().int().positive().nullable().optional(),
    notes: z.string().max(2000).optional(),
    origin: ClientOrigin.default("user_created"),
  })
  .strip()

const PatchSchema = z
  .object({
    campaignId: z.string().min(1).max(80),
    status: z.enum(["draft", "active", "paused", "completed", "cancelled"]).optional(),
    name: z.string().min(3).max(120).optional(),
    objective: z.string().max(500).optional(),
    channels: z.array(ChannelEnum).max(6).optional(),
    plannedBudgetCents: z.number().int().min(0).nullable().optional(),
    utmCampaign: z.string().max(64).nullable().optional(),
    startDate: z.number().int().positive().nullable().optional(),
    endDate: z.number().int().positive().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strip()

/** Compact, client-safe projection of a stored campaign plan. */
function present(doc: CampaignDoc) {
  return {
    id: doc.id,
    name: doc.name,
    objective: doc.objective,
    channels: doc.channels,
    status: doc.status,
    plannedBudgetCents: doc.plannedBudgetCents,
    utmCampaign: doc.utmCampaign,
    startDate: doc.startDate,
    endDate: doc.endDate,
    notes: doc.notes ?? null,
    origin: doc.origin,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    pausedAt: doc.pausedAt,
    cancelledAt: doc.cancelledAt,
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isCampaignsEnabledForUser(user.id)) {
      return ok({ enabled: false, campaigns: [] })
    }

    const campaigns = await listCampaigns(id)
    return ok({ enabled: true, campaigns: campaigns.map(present) })
  } catch (e) {
    return handleRouteError("api.projects.campaigns.get", e)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    await checkRateLimit({ action: "campaigns_create", identifier: user.id, limit: 60, windowMs: 60 * 60 * 1000 })

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isCampaignsEnabledForUser(user.id)) {
      return fail("FEATURE_DISABLED", "Campaigns aren't available for this account yet.", 403)
    }

    const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "A campaign needs a short name.", 422)

    const campaign = await createCampaign({
      userId: user.id,
      projectId: id,
      name: parsed.data.name,
      objective: parsed.data.objective,
      channels: parsed.data.channels,
      plannedBudgetCents: parsed.data.plannedBudgetCents ?? null,
      utmCampaign: parsed.data.utmCampaign ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      notes: parsed.data.notes,
      origin: parsed.data.origin,
    })
    return ok(present(campaign))
  } catch (e) {
    return handleRouteError("api.projects.campaigns.post", e)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    await checkRateLimit({ action: "campaigns_update", identifier: user.id, limit: 120, windowMs: 60 * 60 * 1000 })

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isCampaignsEnabledForUser(user.id)) {
      return fail("FEATURE_DISABLED", "Campaigns aren't available for this account yet.", 403)
    }

    const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please provide a valid update.", 422)
    const {
      campaignId,
      status,
      name,
      objective,
      channels,
      plannedBudgetCents,
      utmCampaign,
      startDate,
      endDate,
      notes,
    } = parsed.data

    const wantsFieldEdit =
      name !== undefined ||
      objective !== undefined ||
      channels !== undefined ||
      plannedBudgetCents !== undefined ||
      utmCampaign !== undefined ||
      startDate !== undefined ||
      endDate !== undefined ||
      notes !== undefined
    if (!status && !wantsFieldEdit) return fail("VALIDATION", "Nothing to update.", 422)

    let updated: CampaignDoc | null = null

    if (wantsFieldEdit) {
      updated = await updateCampaignFields({
        userId: user.id,
        projectId: id,
        campaignId,
        ...(name !== undefined ? { name } : {}),
        ...(objective !== undefined ? { objective } : {}),
        ...(channels !== undefined ? { channels } : {}),
        ...(plannedBudgetCents !== undefined ? { plannedBudgetCents } : {}),
        ...(utmCampaign !== undefined ? { utmCampaign } : {}),
        ...(startDate !== undefined ? { startDate } : {}),
        ...(endDate !== undefined ? { endDate } : {}),
        ...(notes !== undefined ? { notes } : {}),
      })
    }
    if (status && isCampaignStatus(status)) {
      updated = await updateCampaignStatus({ userId: user.id, projectId: id, campaignId, status })
    }
    if (!updated) return fail("VALIDATION", "Nothing to update.", 422)
    return ok(present(updated))
  } catch (e) {
    return handleRouteError("api.projects.campaigns.patch", e)
  }
}
