# Atai Marketing & Monetization — Phase 6 (W5): Campaigns (planning & tracking subset)

Date: 2026-10-10
Branch: main (working tree only — nothing committed/pushed by this phase)
Scope owner: autonomous delivery per `docs/audits/atai-marketing-monetization-audit.md` §14, Phase 6 (W5).

---

## 1. What this phase is — and the honest boundary

W5 in the roadmap is "Campaigns (planning → scheduling → execution) & attribution". This
phase ships the **planning & tracking subset only**. The scheduler/executor and the
checkout/webhook attribution branch are deliberately NOT built here, for concrete,
verifiable reasons:

- **There is no job substrate.** No job collection, cron, worker, or queue exists in this
  repo. "Campaign execution", scheduling, and retries cannot be honestly implemented, so
  none is faked. A campaign records only what the founder *plans* and the lifecycle status
  they set *manually*.
- **Email/social/ad execution needs prerequisites that do not exist** — a consent +
  unsubscribe layer for messaging (Category E.3), and per-platform API approvals for
  posting/ads. Neither is present, so Atai sends, posts, and spends nothing.
- **Money-touching attribution (projectId-stamped Dodo checkout + webhook branch) is
  gated behind a CI pipeline that does not exist** (Category E.5). Modifying checkout/webhook
  payloads without test coverage would risk the billing rails, so the UTM work in this phase
  is a **pure, offline link builder only** — it changes no checkout, no webhook, no ledger.

Consequence: `plannedBudgetCents` is a **tracked founder number, never spend**. Channels are
**labels, not actions**. Nothing here is a measured result, and the UI says so.

## 2. Data layer (`campaigns` + `campaign_history`)

- `lib/types/db.ts` — `CampaignStatus` (`draft|active|paused|completed|cancelled`),
  `CampaignChannel` (`email|social|content|seo|referral|other`), `CampaignOrigin`
  (`ai_generated|user_created`), `CampaignDoc`, `CampaignHistoryDoc`. Real null semantics for
  `plannedBudgetCents`/`utmCampaign`/`startDate`/`endDate`/`pausedAt`/`cancelledAt`.
- `lib/db/collections.ts` — `campaignsCol()` / `campaignHistoryCol()`; `ensureIndexes()` block
  with unique+sparse `campaigns_id_unique` / `campaign_history_id_unique`, `{projectId,status,updatedAt}`,
  `{userId,createdAt}`, `{campaignId,createdAt}`.
- **Hard rule respected:** link by `projectId`; nothing is embedded in the `projects` doc.
  There is **no `campaign_executions` table** — that needs the job substrate and is out of scope.

## 3. Campaign service (`lib/marketing/campaigns/service.ts`)

Tenant-scoped plan store with append-only audit history. Mirrors the W4 task service posture:

- `createCampaign` — trims/validates name; **re-asserts `project.userId === userId` via
  `store.getProject` before any write and fail-closes** with `AppError("UNAUTHORIZED_PROJECT_ACCESS")`;
  defaults to `status:"draft"`; drops invalid/duplicate channels; coerces bad budget/dates to real
  `null`; id `campaign_${cryptoId()}`; appends a `created` history row.
- `updateCampaignStatus` — enforces the exported **`CAMPAIGN_TRANSITIONS`** machine
  (`completed`/`cancelled` are terminal; every state may be cancelled; paused↔active), sets
  `pausedAt` on the pause edge (cleared on resume) and `cancelledAt` on the cancel edge; appends a
  `status` history row.
- `updateCampaignFields` — applies only changed fields, one `updated` history row per field.
- `listCampaigns` / `getCampaign` / `getCampaignHistory` — read-only, tenant-scoped, free.
- History is **best-effort durability**: a history failure is logged loudly but never fails the
  primary mutation.
- **FREE** — no credit charge/refund path exists for campaigns.

## 4. Pure UTM helper (`lib/marketing/campaigns/utm.ts`)

`buildTrackedUrl(baseUrl, params)` validates an absolute http(s) base via `URL`/`URLSearchParams`,
preserves existing query + fragment, appends non-empty UTM params, and **returns `{url:null, reason}`
for a bad base rather than fabricating a URL**. Plus `channelToUtmMedium` (convention) and `slugify`.
No network, no DB, no checkout/webhook mutation — a convention helper only.

## 5. Co-founder tools (`lib/cofounder/tools/campaigns.ts`)

- `propose_campaign` — **CONFIRM**. `prepare()` gates the flag + `ownedProject`, then creates a
  pending action **WITHOUT persisting and WITHOUT a cost**. `executeApproved()` re-gates and calls
  `createCampaign` with `origin:"ai_generated"` and the SESSION user id. Atomic claim (framework)
  prevents double-run.
- `list_campaigns` — **READ**, immediate, returns a bounded projection of the founder's own plans.
- Wiring: `proposeCampaignSchema`/`listCampaignsSchema` (`lib/cofounder/schemas.ts`);
  `campaign`/`campaigns_list` added to `ToolResultType` (`lib/cofounder/types.ts`); both tools
  registered in `lib/cofounder/tool-registry.ts` (READ + CONFIRM sections).
- The client API can only stamp `origin:"user_created"` — `ai_generated` is reserved for the
  approval-gated tool and cannot be forged from the browser.

## 6. API route + UI

- `app/api/projects/[id]/campaigns/route.ts` — GET/POST/PATCH. Session auth, uniform-404
  `checkProjectOwnership`, rate-limited writes (`campaigns_create`/`campaigns_update`),
  flag-gated, FREE. `present()` maps stored docs to a compact client shape.
- `lib/marketing/feature-flags.ts` — `isCampaignsEnabledForUser` (cohort `campaigns:${userId}`,
  **default OFF**, `CAMPAIGNS_ENABLED` / `CAMPAIGNS_ROLLOUT_PERCENT`; garbage percent → off).
- `app/project/[projectId]/campaigns/page.tsx` — `requireOwnedProject`; when the flag is off it
  renders the **exact** `ProjectComingSoon` experience (no half-built surface).
- `components/marketing/campaigns-panel.tsx` — create plans, lifecycle actions derived from the
  same transition machine (Start/Pause/Resume/Complete/Cancel), and the pure tracked-link builder.
  Copy explicitly states Atai does not send, post, spend, or schedule.
- `lib/navigation/routes.ts` — `campaigns` project target (union + `PROJECT_TARGETS` + resolver),
  and a leftover duplicate `| "tasks"` from W4 was removed.

## 7. Verification (real, this session)

- **Scoped type-check** of all new/touched files (transient tsconfig, since deleted):
  `CAMP_TSC_EXIT=0`, **zero errors**.
- **Targeted tests** (campaign service, utm, campaigns tool, feature-flags, routes, registry):
  **6 files / 76 tests passed**, `CAMP_VITEST_EXIT=0`.
- **Full suite**: **92 files / 1190 tests passed**, `CAMP_FULL_EXIT=0` (prior baseline 89 files /
  1151 tests → **+3 files, +39 tests**, all new).
- Background-notification "exit code 0" was NOT trusted; results were read from the real
  `*_EXIT=` markers and the `Test Files` / `Tests` summary lines in the output files.

NOT claimed (honest): no production build was run (tree-wide `tsc`/`pnpm build` are pathologically
slow/broken on this host — Turbopack `0xc0000142`); no scheduled campaign job ran (none exists); no
browser/feature click-through was performed; no provider (Dodo/OpenRouter/Totalum) was exercised.
Compiling + green unit/integration tests do NOT mean this is production-ready.

## 8. Regression posture

Strictly additive: `create-project`/build/hosting/billing/credit-ledger code untouched; `collaborate`
and plan-sections untouched; Dodo checkout/webhook payloads untouched (attribution deferred);
`ToolResultType` has no exhaustive switch that new members break; `routes.ts` union has a single
`tasks` and one `campaigns`. The flag defaults OFF, so with no env set the route falls back to the
previous coming-soon experience and both tools refuse loudly — nothing is reachable that isn't enabled.

## 9. Handoff — what is intentionally deferred (do not fake it later either)

1. **Campaign execution / scheduling** — needs a real job substrate (collection + cron/worker +
   retry + idempotency). Until it exists, campaigns remain plan/track only.
2. **Email/social/ad execution** — needs a consent + unsubscribe + data-deletion story (messaging)
   and per-platform API approvals (posting/ads); advertising additionally needs a committed provider
   + approval + budget-cap + kill-switch before any spend-affecting tool.
3. **Checkout/webhook attribution** — the `projectId`-stamped Dodo checkout + webhook branch +
   UTM→metric linking must wait for a CI pipeline and provider-side checks; today the UTM helper is
   pure/copy-only.
4. **Cross-project rollups & campaign analytics dashboards** — need the event/analytics decision
   (audit §16 open question 1) before any numeric metric can be shown honestly.
