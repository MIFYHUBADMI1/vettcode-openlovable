# Atai — Marketing & Monetization Workspace: Phase 1 Codebase Audit

- **Audit date:** 2026-10-09
- **Repository:** `C:\Users\USER\Desktop\mirrorsiteai` (package name `atai`, v5.0.0, branch `main`)
- **Method:** Read-only static inspection of the repository (source, tests, docs, dependency manifests, env var *names* only). Six parallel deep-dive passes covered: dashboard/workspace, AI infrastructure, runtime SDK/gateway, data model, marketing/monetization capabilities, and security/integrations/UX/testing. **No application code, schema, dependencies, credentials, configuration, or external systems were modified. No destructive or mutating commands were executed.**
- **Verification limitation:** No live database, provider account, or running deployment was exercised. "VERIFIED" in this report means *fully wired in code and consistent under cross-layer inspection (and often unit-tested)* — it does not mean a live end-to-end smoke test was performed. Anything requiring live evidence is labeled UNVERIFIED.
- Status vocabulary used throughout: **VERIFIED WORKING / PARTIALLY IMPLEMENTED / UI ONLY / NOT IMPLEMENTED / EXTERNAL DEPENDENCY REQUIRED / UNVERIFIED.**

---

## Section 1 — Executive summary

**What Atai is today.** A production-grade *application builder + hosting + monetization-of-the-platform* SaaS. The core loop genuinely works end-to-end in code: idea/URL/GitHub intake → AI planning pipeline → structured `ApplicationSpecification` → Totalum build/deploy → project workspace with runtime control center, database viewer, env/secrets management, and a mature, approval-gated AI co-founder agent. Billing (Dodo Payments, credit ledger, subscriptions), referrals, and a provider-neutral runtime API gateway with per-request metering are all real and heavily tested.

**What Atai does not have.** Essentially *none* of the Marketing & Monetization feature set exists as a product capability. Every founder-facing growth surface — `/market`, `/ads`, `/finances`, `/competition`, `/lessons` and their per-project variants — renders an honest `ComingSoonPage` / `ProjectComingSoon` placeholder, and the project sidebar already reserves these slots with `kind: "soon"` badges (`components/workspace/atai-nav.ts:58–67`). There is **no campaign system, no ad-platform integration, no SEO tooling, no content studio, no event ingestion or product analytics, no customer/lifecycle model, no experiments, and no founder-facing reporting**. Marketing output today is limited to AI-written *prose fields* (`marketingPlan`, `launchPlan`, `growthPlan`, `seoPlan`) embedded in the app specification (`lib/types/specification.ts:69–73`) — deliberately parked "for later use elsewhere" (`lib/analysis/plan-sections.ts:12–16`); that "elsewhere" is the workspace being planned.

**Biggest opportunity.** The workspace does not need new platform plumbing — it needs a product layer on top of four strong, already-tested foundations: (1) the co-founder agent + pending-action approval framework, (2) the runtime capability gateway (11 provider adapters incl. Firecrawl search/scrape, Resend email, Twilio SMS, Dodo payments), (3) the credit ledger + metering stack for usage/cost attribution, and (4) reserved routes, navigation slots, and project-ownership auth wiring. A large share of the vision is therefore *greenfield feature work on proven rails*, not re-architecture.

**Biggest blockers.**
1. **No data source for most growth metrics.** Generated apps report **no** visitor, conversion, or customer events back to Atai (no ingestion endpoint, no analytics collection, no SDK telemetry — by design). The only attributable generated-app business signal is `payments.createCheckout` *creation* counts in `runtime_usage`; completed purchases are not attributed to projects (§9).
2. **No background-job infrastructure** (no queue, worker, cron, or scheduler; pipelines are fire-and-forget promises + client polling). Scheduling, retries, and bulk operations — core to campaigns — must be built (§12, Section 13 Cat-E).
3. **No browser-safe/ingestion key tier and single-scope auto-provisioning** (`PROVISIONED_KEY_SCOPES = ["ai.text"]`) — generated apps cannot currently call `db`/`payments`/new capabilities without scope changes (§6, Section 15).
4. **No consent/unsubscribe infrastructure** and email is transactional-only — mandatory prerequisites for any lifecycle marketing (§10).

**Recommended approach.** Build the workspace in the reserved project-level nav slots as an integrated part of the existing workspace; start with capabilities computable from data Atai *already has* (project context, spec fields, credit/payment records, referrals, runtime usage) plus crawl-based SEO/competitor snapshots via Firecrawl; defer everything requiring external providers (ad platforms, social publishing, search-console data) or new instrumentation behind explicit, provider-agnostic integration seams. Never display unavailable metrics — show "not connected yet", consistent with the codebase's existing anti-mock-data convention (`components/workspace/project-coming-soon.tsx` explicitly states "nothing here is simulated").

---

## Section 2 — Repository and architecture map

**Framework & entry points.** Next.js **16.3.3** App Router (`app/`), React 19, TypeScript 5.7, Tailwind v4 + shadcn/ui (style `base-nova`, `components.json`), pnpm workspace (`packages/*`, `pnpm-workspace.yaml`). Root layout `app/layout.tsx`; marketing pages (`app/about`, `pricing`, `sdk`, `docs`, `developers`, `explore`, `resources`); authed surfaces under `app/dashboard`, `app/project/[projectId]/*`, `app/settings/*`, `app/admin/*`. Edge request gate is `proxy.ts` (Next 16's middleware replacement), regression-tested in `proxy.test.ts`.

**Backend.** No separate backend service — ~126 route handlers under `app/api/**` are the API. Shared response envelope `lib/api/respond.ts`; error normalization `lib/api/upstream-error.ts`.

**Database.** MongoDB via the raw `mongodb` 7.6 driver (no ORM), lazy singleton client `lib/db/mongodb.ts`; 30 typed collection accessors in `lib/db/collections.ts` + 3 in `lib/db/runtime-collections.ts` (38 total verified in code). Schema evolution is code-first with idempotent `ensureIndexes()` at first DB access; **there is no migrations tool** (contrary to `docs/DATABASE_SCHEMA.md`). Store abstraction: `lib/store/store.ts` (interface) + `lib/store/mongo-store.ts` (only impl, exported as `store`).

**Auth.** DB-backed opaque session cookies (`Atai_session`, httpOnly/secure/sameSite=lax, SHA-256 hash in `sessions` with TTL) — `lib/auth/session.ts`; bcrypt passwords; Google/GitHub OAuth. Helpers: `requireUser`, `requireAdmin` (session.ts:116), `lib/workspace/require-owned-project.ts` (pages), `lib/runtime/ownership.ts` `checkProjectOwnership` (fail-closed, APIs). Rate limiting: Mongo fixed-window `lib/auth/rate-limit.ts`.

**AI infrastructure.** Vercel AI SDK `ai` v7 + `@ai-sdk/openai-compatible` pointed at **OpenRouter**. Four subsystems: co-founder tool-calling agent (`lib/cofounder/agent.ts`, `stopWhen: stepCountIs(6)`); planning orchestrator (`lib/planning/orchestrator.ts`, 5 AI stages with per-stage model registry `lib/planning/models/registry.ts`, retries `lib/planning/utils/retry.ts`, circuit breaker, semantic validator, sanitizer); legacy analysis pipeline (`lib/analysis/pipeline.ts`); plan chat/analysis/auto-complete services (`lib/analysis/plan-analysis-service.ts`). All structured output is `generateText` → `extractJson` → zod (no `generateObject`/`streamObject` anywhere).

**Runtime SDK & gateway.** `packages/atai-sdk` (`@atai-group/sdk` v1.0.0, zero-dep ESM, 14 capability namespaces); single RPC endpoint `app/api/runtime/v1` → `lib/runtime/router/router.ts`; 11 adapters registered in `lib/runtime/router/adapters/register-all.ts` (OpenRouter, ElevenLabs, Firecrawl, Resend, Twilio, Firebase, Mapbox, Cal.com, Cloudflare, Totalum, Dodo); key crypto/scoping/metering under `lib/runtime/**`; contracts in `runtime/contracts/**`. Generated apps are built/hosted on **Totalum** (external; SDK not in this repo).

**Billing & payments.** Dodo Payments (`dodopayments` ^2.49.0): platform checkout/webhooks/subscriptions under `lib/billing/**` + `app/api/billing/**`; hand-rolled Standard-Webhooks HMAC verification `lib/billing/dodo-webhook.ts`; double-entry credit ledger `lib/billing/credit-service.ts` (1,284 lines) with idempotency keys; live pricing config singleton `app_settings` (`lib/billing/runtime-config.ts`).

**Analytics today.** `@vercel/analytics` mounted platform-site-only (`app/layout.tsx:1,250`). `runtime_usage` = platform-API metering, not visitor analytics. No product-event collection exists.

**Email/notifications.** Nodemailer SMTP, transactional only (`lib/email/mailer.ts`, `templates.ts`). Resend/Twilio/Firebase exist only as generated-app runtime adapters.

**Hosting/deploy.** Totalum integration `lib/integrations/totalum/**` (build, deploy, domains, logs, secrets, database); deployment history embedded on `projects.deploymentHistory[]`; `publish_events` collection.

**Testing.** Vitest 5 (`vitest.config.ts`, node env, no jsdom), **77 test files**, concentrated in `lib/runtime`, `lib/billing`, `lib/planning`, `lib/auth`, `packages/atai-sdk`. **No CI/CD pipeline** (no `.github/`, no `vercel.json`). No UI/e2e/integration tests.

**Docs.** `docs/` contains 26 markdown files; several are stale (notably `DATABASE_SCHEMA.md`, see §7). Root contains many historical implementation reports and two unrelated audits (`audit-phase1.md`, `atai-phase2-audit.md` — Team Progress page).

---

## Section 3 — Existing functionality inventory (capabilities relevant to the proposed workspace)

Verified in code, directly relevant to Marketing & Monetization:

| Capability | Location | What it genuinely provides |
|---|---|---|
| Project anchor with rich business context | `projects` collection; `lib/types/project.ts` (`MirrorProject`); `lib/types/understanding.ts`; `lib/types/specification.ts` | Purpose, target users, value proposition, business model, revenue model, pricing tiers, brand identity, SEO/marketing/launch/growth *plan prose* — AI-generated, editable, persisted |
| AI co-founder agent (tools + approvals) | `lib/cofounder/{agent,tool-registry,context,pending-actions,prompts}.ts`; `app/api/cofounder/**`; `components/cofounder/**` | 20+ registered tools, 4-tier risk ladder (READ/LOW_RISK_WRITE/CONFIRM/HARD_CONFIRM), atomic single-use pending-action claim, TTL expiry, full approve/reject audit trail, per-turn rate limit |
| Planning pipeline (idea→spec) | `lib/planning/orchestrator.ts` + `stages/*` | Multi-stage AI pipeline with research gap-analysis, critic/repair, zod validation, credit reservation/refund, `planning_runs` telemetry |
| Plan section editing + analysis | `lib/analysis/plan-sections.ts`, `plan-analysis-service.ts`, `app/api/projects/[id]/{plan-chat,analyze-plan,auto-complete}` | Editable sections incl. `seo`, `businessModel`, `revenueModel`, `pricingTiers`, `marketPositioning`, `brandIdentity`; proposal-gated persistence; plan quality scoring |
| Website crawl/scrape/search | `lib/integrations/firecrawl/{client,service}.ts`; `firecrawl_cache` (7-day TTL) | `scrapeUrl`, `mapUrl`, `crawlSiteUrl`, `searchWeb`, cost caps, deep-crawl modes; powers current site-understanding |
| Runtime capability gateway | `lib/runtime/router/**`; `runtime/contracts/**` | AuthN/AuthZ, scopes, rate limits, per-project config caps, concurrency slots, metering, fail-closed billing, request explorer, CSV export |
| Generated-app payments (checkout) | `lib/runtime/router/adapters/dodo/**`; SDK `payments` namespace | Project-attributed *checkout-created* events via `runtime_usage` |
| Platform billing + credit ledger | `lib/billing/**`; `credit_ledger`, `payment_records`, `subscription_records`, `webhook_events` | Real MRR-capable source data for **Atai's own** revenue; idempotent, signature-verified |
| Referral program | `lib/referrals/referrals.ts`; `app/api/referrals`; `components/referral-dashboard.tsx` | Working referral codes/capture/rewards/fraud flags — the only live growth loop |
| Onboarding intent data | `lib/onboarding/{state,profile}.ts`; `users.onboarding` (revenueTarget, targetUsers, businessGoal, intent, pace) | Founder business intent captured pre-project — feeds workspace personalization |
| Approval-gated action UI | `components/cofounder/action-cards.tsx` + pending-action API | Reusable "AI proposes → founder approves → execute → result" pattern |
| Data-heavy workspace UX template | `components/runtime-control/*` (usage tables, cursor pagination, breakdowns, filters, export, health) | The closest existing design template for dashboards |
| Image generation | `app/api/projects/[id]/generate-visual/route.ts`, `lib/billing/visual-pricing.ts`, ImageKit | Credit-priced AI visual asset generation, persisted to `project_assets` |
| Reserved marketing surface | `app/project/[projectId]/{market,ads,finances,lessons,resources,competition}`, `app/{market,ads,finances,competition}`, `workspaceGrowNav` slots | Ownership-gated placeholder pages + nav with "Soon" badges — the integration seam |

---

## Section 4 — Capability assessment matrix (Section 8 of the brief)

### A. Project growth overview

| Capability | Status | Evidence & notes |
|---|---|---|
| Growth dashboard page | UI ONLY | `app/project/[id]/market/page.tsx:1–16`, `app/market/page.tsx:1–11`, `app/finances`, `app/project/[id]/finances` → `ProjectComingSoon`/`ComingSoonPage` |
| Goal configuration | PARTIALLY IMPLEMENTED | `users.onboarding.businessGoal/revenueTarget/targetUsers` captured during onboarding (`lib/onboarding/state.ts`); no per-project editable goals UI |
| Website visitor metrics / traffic sources | NOT IMPLEMENTED | No ingestion of generated-app traffic; `@vercel/analytics` is platform-site only (`app/layout.tsx:250`) |
| Sign-ups / activation / funnels | NOT IMPLEMENTED | No `user_events` collection or funnel code |
| Paying customers / revenue / MRR (per project) | NOT IMPLEMENTED | Platform revenue exists (`payment_records`, admin billing overview) but is Atai's own, not per-generated-app |
| Retention / churn | NOT IMPLEMENTED | Only churn signal: `cancellation_feedback` (platform plan cancellations; untyped, no indexes) |
| Campaign performance / marketing health | NOT IMPLEMENTED | No campaigns (see D) |
| AI growth recommendations + prioritized next steps | PARTIALLY IMPLEMENTED | Build-journey next-step engine exists (`lib/workspace/workspace-view-model.ts`, "grow" stage → generic "Ask your co-founder"); no growth-specific recommendations |
| Time-range filtering, metric definitions, freshness, source attribution, empty states | NOT IMPLEMENTED (patterns reusable) | Runtime usage UI has date/breakdown patterns (`components/runtime-control/usage-client.tsx`); empty-state components exist |

### B. AI Marketing Studio

| Capability | Status | Evidence |
|---|---|---|
| Strategy/positioning/messaging/value-prop/personas | PARTIALLY IMPLEMENTED (as spec text) | Generated into `specification` during planning (`lib/analysis/specification.ts:84–104`); editable plan sections incl. `marketPositioning`, `valueProposition`, `targetUsers` (`lib/analysis/plan-sections.ts:50–191`). Not a studio; strings on the spec |
| Campaign briefs / launch plans / checklists | TEXT-ONLY | `marketingPlan`/`launchPlan`/`growthPlan` prose (`lib/types/specification.ts:69–73`); explicitly *excluded* from editable sections (`plan-sections.ts:12–16`) |
| Social/blog/landing/email copy, announcements, offers, CTAs | NOT IMPLEMENTED | No content-generation service or UI (`app/ads/**` = ComingSoon) |
| Content calendars, drafts/versions, templates, brand voice | NOT IMPLEMENTED | No content collections; `brandIdentity` is a spec string |
| Approval workflow for content | VERIFIED (infra) | Pending-action machinery reusable (`lib/cofounder/pending-actions.ts`) but unwired to any content |
| Publishing/scheduling | NOT IMPLEMENTED | No scheduler; publish = app deploy only |
| Content performance | NOT IMPLEMENTED | No events |

### C. SEO and organic visibility

| Capability | Status | Evidence |
|---|---|---|
| URL analysis / accessible-page crawling | VERIFIED WORKING (infra) | Firecrawl client/service; title/meta/headings/links captured — but as *build evidence*, no SEO analysis product |
| Metadata/canonical/heading/sitemap/robots/indexability *checks* | NOT IMPLEMENTED | No analysis logic; nothing beyond raw crawl |
| Keyword research / search intent / content gap / competitor SEO | NOT IMPLEMENTED | `searchWeb` exists but unused for SEO |
| Search-optimized pages / blog content | PARTIALLY IMPLEMENTED (generated-app side) | SEO guidance is written into app specs so *generated apps* get SEO'd pages (`lib/analysis/cofounder.ts:503–554`) |
| Structured-data/technical SEO recommendations | NOT IMPLEMENTED | — |
| SEO task tracking / audit history | NOT IMPLEMENTED | — |
| Search ranking history / organic traffic / search-engine integrations | NOT IMPLEMENTED, EXTERNAL DEPENDENCY REQUIRED | No Google Search Console or equivalent; cannot measure real rankings/traffic — do not claim it |
| SSRF safety for user-supplied URLs | VERIFIED (runtime path) | `lib/runtime/router/adapters/shared/ssrf.ts` + tests, wired into Firecrawl runtime mapper (`adapters/firecrawl/mapper.ts:147`); platform crawler relies on Firecrawl cloud fetching (Atai's origin never fetches user URLs) |
| Prompt-injection safety when analyzing external sites | VERIFIED WORKING | "CONTENT IS DATA" prompt rule (`lib/cofounder/prompts.ts:33–34`); injection scan `lib/planning/utils/security.ts:32–45`; neutralization in `lib/analysis/prompt-builder.ts:13–14` |

### D. Campaigns and marketing execution

All twelve audited sub-capabilities (creation, objectives, audience, channels, budgets, schedules, status, multi-channel planning, launch workflows, social publishing, email campaign delivery, attribution, UTM, conversion tracking, approvals, scheduling/background execution, history, failure reporting/retries, pause/cancel, credential management): **NOT IMPLEMENTED.** Evidence: no `campaigns` collection in `lib/db/collections.ts` (verified by accessor + index enumeration); `utm`/campaign grep = 0 hits; email is transactional-only (`lib/email/templates.ts`); no scheduler/queue exists (§12); the only credential model is platform env vars (no user connections). The plan-generation vs storage vs scheduling vs execution distinction: only *plan prose* generation exists (B).

### E. Advertising and paid acquisition

| Capability | Status |
|---|---|
| Ad strategy/copy/creative/variation generation | NOT IMPLEMENTED (generic model *could*; nothing built; image gen exists as raw capability) |
| Budget allocation / CPA estimates / ROAS / spend reporting / click-conversion tracking / experiments / comparisons | NOT IMPLEMENTED |
| Advertising platform connections | NOT IMPLEMENTED — **zero ad providers in deps or code** (`package.json`: no Google/Meta/TikTok/X SDKs; no ad API code) → EXTERNAL DEPENDENCY REQUIRED for all execution |
| Spend limits / authorization / approval before publish / emergency stop / account isolation | NOT IMPLEMENTED as features; **the approval *pattern* exists** (HARD_CONFIRM + pending actions) and is the right primitive to build on |

### F. Monetization Lab

| Capability | Status | Evidence |
|---|---|---|
| Atai platform billing (credits/subscriptions, Dodo) | VERIFIED WORKING | `app/api/billing/{checkout,webhook,subscription,overview}/**`, `lib/billing/dodo-service.ts` (auto-provisions products), signature-verified idempotent webhooks, well-tested. **Note:** Stripe references in `docs/DATABASE_SCHEMA.md` are stale — code uses Dodo only |
| Generated-app payments via runtime | PARTIALLY IMPLEMENTED | Only `payments.createCheckout` (`runtime/contracts/router.ts:107`); no subscriptions/refunds/usage-based for generated apps; completion not project-attributed (§9) |
| Pricing tiers / business model as *plan* | PARTIALLY IMPLEMENTED | Editable spec sections `pricingTiers`, `businessModel`, `revenueModel`; pricing-tier builder UI in Collaborate (`components/collaborate/*`); text/config, not live offers |
| Monetization Lab workspace (pricing recs, trials, freemium/usage models, promos/coupons, upsell, forecasting, LTV, experiments) | NOT IMPLEMENTED | `app/market/**` ComingSoon; `coupon`/`discount` grep: only Dodo `discount:0` constants |
| Founder payment-provider key requirement | N/A — GOOD NEWS | Runtime already routes Dodo server-side with platform-managed keys; generated apps need **no provider keys**. Keep this property |
| Atai-billing vs generated-app-payments conflation | DISTINGUISHED | `adapters/dodo` comments explicitly scope it to generated apps; platform checkout is separate. The workspace must preserve this separation |

### G. Customers, lifecycle, and retention

| Capability | Status |
|---|---|
| Referral program | VERIFIED WORKING (Atai's own growth loop): `lib/referrals/referrals.ts`, capture wired into register/Google/GitHub/verify-email/build milestones; fraud flags; admin + user dashboards |
| Customer identity / lifecycle events / onboarding funnel / activation / cohorts / churn / inactive detection / segmentation / lifecycle email / welcome-reengagement-winback / comms preferences / unsubscribe-suppression / consent records / automation scheduling / performance reporting | **NOT IMPLEMENTED** — no `customers`/`user_events` collections (verified absence); no consent fields; transactional email only |
| Access to generated-app customer data | **EFFECTIVELY NOT AVAILABLE** — Atai can read a generated app's Totalum DB rows via `app/api/projects/[id]/database/**` (raw table viewer), but auto-provisioned runtime keys lack `db` scope, there is no customer schema convention, and nothing consumes it for lifecycle purposes. Do not assume access; consent-aware mechanisms + an app-side opt-in contract would be new work |

### H. Analytics and growth experiments

| Capability | Status |
|---|---|
| Event ingestion / schemas / user-session identity / anonymous attribution / traffic-source attribution / conversion definitions / funnels / cohorts / retention / revenue attribution / campaign attribution / analytics dashboards / dedup / timezone handling / retention policy / privacy controls | **NOT IMPLEMENTED** — no `/events`/`/track`/`/ingest` route anywhere in `app/api` (full tree enumerated); SDK explicitly "No telemetry" (`packages/atai-sdk/README.md:164–165`); `visitorId` exists only for doc-feedback dedup (`app/api/public/feedback`) |
| Existing adjacent data | `runtime_usage` (per-project capability metering, VERIFIED) is the only project-attributable time series Atai has; `publish_events`; `credit_ledger` |
| Experiments (definition/hypothesis/allocation/outcome/statistics/history) | **NOT IMPLEMENTED** — zero experiment/A-B code; do not treat variant content as valid tests |

### I. Growth tasks and execution management

**NOT IMPLEMENTED** as a marketing capability. Strongest reusable infra: feature-request board pattern (status + status history + updates + internal notes collections), planning-run tracker, pending-action approvals, co-founder agent. Ownership/due dates/dependencies/notifications for marketing tasks do not exist.

### J. Competition and market intelligence

`app/competition/page.tsx:1–11` and `app/project/[id]/competition/page.tsx:1–16` = **UI ONLY placeholders**. No competitor model/service/tool (verified). Closest real assets: Firecrawl scrape/map/search (data acquisition), planning `ResearchAgent` (LLM gap-analysis only — fetches nothing despite the name), `firecrawl_cache` (7-day TTL cache, not durable research), spec `marketPositioning` prose. Competitor *analysis* exists nowhere as a feature.

### K. Business intelligence and reporting

Founder-facing marketing/growth/campaign/SEO/monetization reports: **NOT IMPLEMENTED**. Admin/ops BI (Atai's own business): **VERIFIED WORKING** but internal — `app/api/admin/{stats,billing/overview,billing/reconciliation,ledger,transactions,runtime/financials,audit-logs}`. Export exists only for runtime usage CSV (`app/api/projects/[id]/runtime/usage/export`). No scheduled reporting.

### L. AI co-founder experience (integration target)

| Capability | Status | Evidence |
|---|---|---|
| Project-aware conversations, context assembly, persistence, resume | VERIFIED WORKING | `lib/cofounder/{agent,context,conversation}.ts`; ownership re-check of client-sent `activeProjectId` (`app/api/cofounder/route.ts:60–66`); 200-msg cap; conversation restored via GET |
| Structured recommendations → task/action with confirmation | VERIFIED (mechanism) | Proposals + pending actions + HARD_CONFIRM typed-word; results written back into transcript |
| Tool invocation / navigation to workspace areas | VERIFIED for build surfaces; **NOT IMPLEMENTED for marketing** — `lib/navigation/routes.ts:32–77` registry excludes market/ads/finances/competition; the agent cannot navigate or act on marketing surfaces today |
| Links recs↔data, explanations of completed actions, recovery from failed actions | PARTIALLY | Action cards show cost/params/result; failures recorded on pending action; no general rec↔evidence linking |
| Usage/cost controls per conversation | VERIFIED | Rate limit 30 msgs/10 min (`app/api/cofounder/route.ts`); credit charging with refund-on-failure in plan services; **gap: agent turns do not capture token usage** (§12) |

---

## Section 5 — Dashboard and project workspace findings

**Current IA.** Global shell `components/dashboard/dashboard-shell.tsx` (436 lines): fixed `NAV` (Home `/dashboard`, Businesses `/projects`, New business) + `DISCOVER_NAV` (Explore, Feature requests); project context detected via `pathname.match(/^\/project\/([^/]+)/)` (line 56) and sidebar swaps to workspace mode. Two nav groups (from `components/workspace/atai-nav.ts`):
- `workspaceProjectNav(projectId)` (lines 41–56): Workspace, Team progress, Collaborate, Plan, Edit plan, Source, Runtime, Database, Environment, Hosting, Export snapshot — all real pages.
- `workspaceGrowNav(projectId)` (lines 58–67): Market & grow, Ads & marketing, Business finances, Business lessons, Resources, Competition — **all `kind: "soon"`**, rendered with a "Soon" pill (dashboard-shell lines 251–272).

`/workspace` is a redirect to `/dashboard`. `components/workspace/atai-sidebar.tsx` is dead code (imported nowhere).

**Key pages (state = code-complete unless noted).** `/dashboard` → `DashboardCommandCenter` (build-journey command center, onboarding first-mission wizard rendered first). `/projects` list (grid/list, filters all/planning/building/live/failed, search, delete). `/project/[id]` overview = `components/workspace/operating-room.tsx` (journey strip Understand→Plan→Build→Validate→Launch, next-step card, capability flags, publish menu, deployment history; view-model `lib/workspace/workspace-view-model.ts` with tests; `JourneyStage` already includes `grow`). `/plan`, `/edit` (plan editor), `/collaborate` (`collaborate-client.tsx`, 2,328 lines — plan sections, chat, proposals, pricing-tier builder, theme builder, visual mockups), `/progress`, `/source`, `/tree`, `/repo-code`, `/readme`, `/database[/table]`, `/env`, `/hosting` (real: PublishMenu + DeploymentHistory when `totalumProjectId` exists), `/runtime/*` (8-page control center). Placeholders: `/market`, `/ads`, `/finances`, `/lessons`, `/resources`(project), `/competition`.

**Project creation.** `/new` chooser (idea / website / github-experimental) → `LandingComposer` with input detection `lib/start/detect-input.ts` (idea|website|url|github) → pre-auth pending start (`lib/start/pending-store.ts`, cookie+server, 10-min TTL) → `/start` restores and calls `createProjectFromPending` (`lib/projects/continue-start.ts`) → redirect to `/project/[id]/collaborate` as the *first workspace*. Core creation `lib/projects/create-project.ts` (modes scratch|website|github; crawlMode relevant|deep; pipelineMode legacy|heavy; idempotency keys; 10/hr rate limit; duplicate detection; fires detached analysis promises). GitHub sub-modes clone/extend (`app/new/github`, `app/api/github/repos`).

**Project metadata.** `MirrorProject` (`lib/types/project.ts:166–210`): mode, state (14-state lifecycle), sourceUrl, understanding, specification, deployment(+history), infrastructure, preferences (`ProjectPreferences` L149–164: appName, stackType, databaseChoice, authProviders, notes), planAnalysis, GitHub fields, visibility, runtimeProvisioning. **No dedicated settings page** — rename/description via PATCH `app/api/projects/[id]/settings`; plan editing at `/edit`. Business/marketing metadata lives inside `specification` (`lib/types/specification.ts:39–86`) as AI-generated text.

**Collaboration/planning.** `lib/planning/orchestrator.ts` (684 lines, heavily tested) + proposal/approval flow via plan-chat + `apply_plan_update`. Shared mutations `lib/projects/project-actions.ts` (459 lines; used by both REST and AI tools; 404-on-not-owned; credit reservation) — **this file is the canonical pattern for any new marketing mutation.**

**Onboarding.** `lib/onboarding/*` (tested); captures revenueTarget/targetUsers/effortScale/hoursPerDay/intent/plan — early business signals to seed marketing recommendations. Admin sees funnel breakdowns.

**Admin.** 20+ pages + 27 API routes under `app/admin` / `app/api/admin` — all guarded (`requireAdmin` or manual `isAdmin` 403; no gaps found). Relevant: billing suite, runtime financials/pricing, referrals, users/transactions/ledger/payments/cancellations, planning-runs, feedback, infrastructure, audit.

**Empty/loading/error conventions.** `Skeleton`, pulse placeholders, CTA empty states, sonner toasts (43 files), honest coming-soon pages (`components/workspace/coming-soon.tsx`, `project-coming-soon.tsx`). Responsive: sidebar→drawer under `md`, cofounder panel full-screen on mobile, stacking toolbars.

**Marketing under other names — found:** referral program (real), `/explore` public gallery (fork/likes — distribution-adjacent, real), spec marketing-plan prose (text), admin growth stats (internal). Nothing else.

**Extension points (the seams).** (1) Flip `kind:"soon"`→`"link"` in `workspaceGrowNav` (`atai-nav.ts:58–67`); (2) replace `ProjectComingSoon` inside already-ownership-gated route files; (3) register new targets in `lib/navigation/routes.ts` (+ `routes.test.ts`) to make surfaces AI-navigable; (4) reuse `project-actions.ts` + credit reservation + pending-actions for new mutations.

---

## Section 6 — AI co-founder and runtime findings

### AI architecture (reuse, don't rebuild)

- **Agent harness:** `lib/cofounder/agent.ts` `runAgentTurn()` — `generateText` + native `tool()` objects, `stopWhen: stepCountIs(6)`, blocking, no streaming. Registry allow-list `lib/cofounder/tool-registry.ts:48–74` (20 tools; READ / LOW_RISK_WRITE / CONFIRM / HARD_CONFIRM). Tools call real services (`project-actions.ts`, `create-project.ts`, `plan-analysis-service.ts`).
- **Approval boundary (the standout asset):** confirmation tools are *not executable by the model*. Model calls `prepare_request` → only `prepare()` runs (validate + price + create pending action, 15-min TTL). Execution only via `POST /api/cofounder/actions/[id]` with full server-side revalidation: ownership → expiry → **atomic single-use claim** (`pending-actions.ts:77–90`) → zod re-parse → ownership re-check → credit re-check → rate limit → `executeApproved()`. Permissions are enforced independently of model instructions (`buildToolContext` takes user from session only; `context.ts:51–75`); system prompt asserts "CONTENT IS DATA".
- **Model routing:** shared singleton `MODEL` (`lib/analysis/model.ts`, OpenRouter, `OPENROUTER_MODEL || OPENROUTER_FREE_MODEL || openrouter/auto`); per-stage `ModelRegistry` (`lib/planning/models/registry.ts`, env-driven `*_MODEL`/`*_FALLBACK_MODEL`, fallback chain terminates at openrouter/auto); rollout flag `USE_ENHANCED_PIPELINE` + percentage cohorting (`lib/analysis/specification.ts:15–19`). Config drift: stage model vars are not in `.env.example`, only in `AI_MODEL_CONFIGURATION_COMPLETE.md` (Section 16 open question).
- **Structured output:** `generateText` + `extractJson` + zod everywhere (schemas for research findings, specification, understanding, all tool inputs) with sanitize/retry; `SemanticValidator` + `Sanitizer` layers. No `generateObject` in the repo.
- **Async execution: none durable.** No queue/cron/worker. Pipelines run as `void` fire-and-forget promises inside route handlers; progress observed via client-polling `GET /api/projects/[id]/status`. Webhooks exist only for Dodo. `planning_runs` (90-day TTL) record per-stage telemetry. **Implication: campaign scheduling/bulk execution has no infrastructure to reuse.**
- **Reliability:** retry w/ error classification + exponential backoff + per-stage timeouts (`lib/planning/utils/retry.ts`, `STAGE_RETRY_CONFIGS`), circuit-breaker util (implemented; no production call sites found), AbortSignal timeouts on plan-chat (120s), provider timeouts env-tunable. Gaps: co-founder agent loop itself has no retry/timeout (canned apology on failure); no cross-provider failover.
- **Web search:** internal agents have **none**; `search.web` exists only via the runtime Firecrawl adapter (generated-app-facing). A marketing agent would need a new tool wrapping the existing Firecrawl client — small, localized.
- **Competitor/marketing agents:** **do not exist** (verified; only a keyword chip in `lib/start/detect-input.ts:72`).
- **Cost/usage:** credit ledger reserve/charge/refund discipline throughout plan services; **agent turns and planning runs do not record tokens** (runs log `model:"auto", tokens:0`, `orchestrator.ts:626–631`); runtime calls fully attributed with immutable price snapshots.

### Runtime SDK & gateway

- **SDK:** `@atai-group/sdk` v1.0.0 — 14 namespaces (`ai, voice, search, web, email, sms, whatsapp, notifications, maps, calendar, vectors, db, payments, health`), zero-dep, server-side-only key (`atai_<env>_<secret>`, no browser-safe tier — explicit), pinned base URL `https://atai.ink` → `/api/runtime/v1`, **no telemetry** (README:164–165).
- **Gateway:** `proxy.ts` edge gate separates Bearer domain (`/api/runtime/v1*`) from session domain; `routeRuntimeRequest` = validate→capability→operation→scope→adapter→metering preflight→execute→meter→normalize; **billing fails closed**; raw provider errors never cross the boundary; `RuntimeRequestSchema` `z.never()`/strict — bodies cannot inject userId/projectId/environment/price (identity derives exclusively from the key record, test-enforced).
- **Keys:** hash-only storage (SHA-256), ownership in-query filters, atomic rotation w/ lineage, 20 creates/day/user; **auto-provisioning** (`lib/runtime/provisioning/service.ts`) creates a least-privilege key per project/env and injects plaintext into the generated app's Totalum secret store (`ATAI_API_KEY`), crash-safe + orphan revocation. **Compat concern: `PROVISIONED_KEY_SCOPES = ["ai.text"]`** (service.ts:78) — generated apps calling `db`/`payments`/future capabilities with the auto key get 403; whether later lifecycle code widens scopes is UNVERIFIED. Treat scope policy as a Phase-2 prerequisite decision.
- **Limits/accounting:** brute-force limiter (20 failed auths/5 min), 300 req/min per key, per-project caps (tighten-only), fail-fast in-process concurrency (32 max), 256KB body cap; per-request `runtime_usage` with provider cost verbatim; admin pricing rules (`app_settings`), CSV export, request explorer, health snapshot.
- **Generated-app security boundaries:** provider keys never touch generated apps (server-side env per adapter); project↔db isolation via `project-binding.ts` (Totalum project resolved *only* from `projects.totalumProjectId`, fails closed); SSRF guard on scrape ops; uniform 401/404 (no state enumeration); logger redaction.
- **Builder wiring:** `prompt-builder.ts:40–45` mandates `@atai-group/sdk` + `ATAI_API_KEY` server-side in generated apps; `runtime-capabilities.ts` grounds integrations; planner sanitizer rewrites external DB/auth to Totalum SDK equivalents (Totalum SDK itself is external/unverifiable here).
- **`/api/internal/*`:** server-to-server for "ATAI WEB" via `x-internal-key` (plain `!==` compare — non-timing-safe; fails closed if unset).

**Growth-feature readiness of the runtime:** additively YES — per-project authenticated identity, abuse protection, and durable attribution storage already exist; the established extension path is contract entry + adapter + SDK namespace + pricing rule (note: **unpriced ops are DENIED before provider spend** — a free event capability needs an explicit zero-price rule). Constraints: volume (300/min + fail-closed preflight suit RPC, not analytics floods → batched op or separate ingestion path), browser-side events (no browser-safe key tier → server-side reporting from generated apps or a new write-only public key design), and revenue attribution (stamp `projectId` into Dodo checkout metadata + webhook branch — small localized change).

---

## Section 7 — Database and data architecture findings

**Access pattern:** raw driver; `xxxCol()` async accessors; dual key convention (`_id` ObjectId + string `id` with unique sparse `{id:1}` — cross-references use string ids); tenancy = flat `userId` (+ `projectId` on child docs); **no organizations/teams/RBAC by design** (`lib/runtime/types.ts` comment); lazy idempotent `ensureIndexes()`; **no migration tool**.

### Collection inventory (38 verified; full detail in the audit passes)

| Collection | File | Tenant keys | Notes for reuse |
|---|---|---|---|
| `users` | collections.ts | — (identity) | credits buckets, `onboarding.businessGoal/revenueTarget/targetUsers`, `githubAccessToken` (plaintext — §10), soft-delete `deletedAt` |
| `sessions`, `verification_tokens`, `rate_limits` | collections.ts | userId | TTL(0); reuse as-is |
| `projects` | collections.ts + `lib/types/project.ts` | userId (single owner) | **Anchor tenant object.** Fat embedded doc (spec/plan/events/conversation/deployment history). **Do not embed marketing data; link by projectId** |
| `build_runs` | collections.ts | userId, mirrorProjectId | reserve→run→settle template |
| `project_assets` | collections.ts | userId, projectId? | **reuse directly for marketing media** (ImageKit files) |
| `provider_usage` | collections.ts | userId?, projectId? | generic external-call metering template |
| `topups` | collections.ts | userId | legacy mobile-money path; billing-adjacent |
| `publish_events` | collections.ts | userId, projectId | only existing "publishing record" — extendable pattern for content publishing |
| `referrals` | collections.ts | referrerUserId, referredUserId | live growth loop |
| `doc_feedback` | collections.ts | visitor hash | minor |
| `webhook_events` | collections.ts | — | idempotency template for future marketing webhooks |
| `credit_ledger` | collections.ts + billing-types | userId | **reuse directly**: `referenceType/referenceId` can point at campaigns/tasks; idempotencyKey unique; no TTL (permanent) |
| `build_authorizations` | collections.ts | userId, projectId | reserve-then-settle pattern |
| `payment_records`, `subscription_records` | collections.ts | userId | Dodo ids; Atai-platform revenue only — **no projectId, no generated-app customer ids** |
| `planning_runs` | collections.ts | userId, projectId | AI-run telemetry; **90-day TTL — unsuitable as durable evidence store without change** |
| `firecrawl_cache` | collections.ts (inline type) | — (URL keyed) | 7-day TTL crawl evidence — closest competitor/SEO data store today, but a cache, not durable research |
| `project_likes`, `user_follows`, `project_forks` | collections.ts | userId pairs/ids | social layer |
| `project_github` | collections.ts | projectId unique, userId | best per-project integration-connection template (stores no tokens) |
| `feature_requests` ×5 (votes/history/updates/notes) | collections.ts | authorId/userId | **excellent task/approval template** — status machine + history + internal notes already modeled |
| `cofounder_conversations` | collections.ts | userId, activeProjectId reference | reusable for marketing assistant transcripts |
| `cofounder_pending_actions` | collections.ts | userId | **the approval-record + execution-history model** — reuse/extend directly |
| `api_keys` | runtime-collections.ts | userId, projectId, environment, scopes | hash-only key model template for future integration credentials |
| `runtime_usage` | runtime-collections.ts | userId, projectId, apiKeyId | **best usage/cost attribution table**; indexes `{projectId,createdAt}` etc.; no TTL (retention policy pending) |
| `project_runtime_config` | runtime-collections.ts | projectId unique | per-project config template |
| `infrastructure_audit_log` | lib/infrastructure/audit.ts | admin/project/user | only general audit log; 1-yr TTL |
| `pending_starts`, `project_create_idempotency` | lib/start/pending-store.ts | userId/token | TTL patterns |
| `cancellation_feedback` | inline, admin routes | userId | churn reasons; **no typed accessor, no indexes** (verified) |
| `app_settings` (`_id:"billing"`) | lib/billing/runtime-config.ts | — | live pricing singleton |

**Verified absent** (grepped accessors + createIndex): organizations/teams/memberships, customers, user/product events, campaigns, content/drafts, analytics/experiments, seo_*, competitors, notifications, tasks, integrations/credentials (GitHub token is a user field; provider keys are env). Legacy `credit_transactions` exists only in `.kiro/specs` migration docs.

**Docs reconciliation:** `docs/DATABASE_SCHEMA.md` is **substantially stale** — claims 15 collections vs 38 actual; says Stripe vs actual Dodo; wrong user/project/BuildRun shapes; invents a `lib/db/migrations/` tool that does not exist. Treat as untrustworthy; this report supersedes it for these facts. Root `DATABASE_TABLE_REDESIGN*.md` files are admin data-grid UI docs, not schema work. `package.json` script `cleanup:credit-transactions` references a script file that does not exist.

### Minimum additional data concepts (candidates, not mandates)

| Concept | Recommendation |
|---|---|
| Growth goals/plans | **New** small collection keyed `{userId, projectId}` (don't fatten `projects` doc) |
| Marketing/growth tasks | **New**, modeled on `feature_requests` + status-history pattern |
| Campaigns + channel executions | **New** (`campaigns`; executions modeled on `build_runs` reserve→run→settle) |
| Content drafts/versions | **New** (`content_items` + `content_versions`); binaries reuse `project_assets` |
| SEO audits/findings | **New** durable `seo_audits`; store the existing zod-validated findings shape (ResearchFindings is currently only a pipeline intermediate) |
| Integration connections | **New** `integrations` following the `api_keys` hash-only pattern; migrate GitHub token off `users` |
| Marketing events/attribution | **New** high-volume `marketing_events`; adopt `runtime_usage` index conventions + explicit TTL policy |
| Funnels | Derive/aggregate over events — avoid separate source-of-truth |
| Monetization experiments | **New** (depends on events; defer) |
| Customer lifecycle segments | **New**, *conditional* — requires app-side consent + an event contract first (G) |
| AI recommendations + evidence | **Extend** conversation/action-card pattern; persist durable recs in own collection (planning_runs TTL deletes evidence) |
| Approvals | **Reuse `cofounder_pending_actions`** (or a shared `pending_actions` generalization) |
| Execution history | Reuse patterns; a marketing `execution_log` is cleaner than stretching the admin audit log |
| Usage/cost attribution | **Reuse `credit_ledger` (`referenceType`) + `runtime_usage`** — no new metering stack |

Conventions to follow: dual `_id`+string id, unique sparse `{id:1}`, `{userId,createdAt:-1}` / `{projectId,createdAt:-1}` composites, idempotency keys on money, lazy `createIndex` bootstrap. Retention must be an explicit decision per collection (precedent: TTL on ephemeral; 90d runs; permanent ledger).

---

## Section 8 — Integrations and provider readiness

**Credential model:** everything is **platform-managed env vars** (names from `.env.example`/`lib/env.ts` only: OPENROUTER, FIRECRAWL, TOTALUM, DODO, RESEND, TWILIO, ELEVENLABS, FIREBASE, MAPBOX, CALCOM, CLOUDFLARE, IMAGEKIT, SMTP, GITHUB/GOOGLE OAuth, ATAI_INTERNAL_KEY, MONGODB_URI). **There are no project- or user-level provider connections anywhere** (no "connect your account" UI/flow). This is aligned with audit principle 5 (avoid unnecessary user key config) — keep it that way wherever platform infra suffices.

| Provider | Locations | Operations | Cred model | Verified | Webhooks | Quota/cost/failure | Marketing suitability |
|---|---|---|---|---|---|---|---|
| **Totalum** (build/host/DB) | `lib/integrations/totalum/**` + runtime adapter | build/deploy/domains/logs/secrets/write-only/db | platform | PARTIAL (some endpoints throw "documentation pending") | — | 30s timeout | hosting/monitoring for generated apps; SEO deploys would route through it |
| **Firecrawl** | `lib/integrations/firecrawl/**`; runtime adapter (search.web/web.scrape) | scrape/map/crawl/search, 7d cache, cost caps | platform | PARTIAL (live behavior unverified) | — | timeouts, caps, cache | **primary data-acquisition layer for SEO + competitor snapshots** |
| **OpenRouter** | `adapters/openrouter/**`, `lib/analysis`, `lib/planning` | all AI text/vision/image/audio/embed; internal model fallback | platform | PARTIAL (multimodal adapter tested; live unverified) | — | 60s default, metered | content/copy/strategy generation engine |
| **Dodo Payments** | `lib/billing/**`; runtime adapter (createCheckout) | checkout/subscriptions/refunds (platform); checkout (generated apps) | platform | PARTIAL (idempotent+signed webhook verified in code; live unverified) | YES, HMAC + replay window + idempotency | pricing rules, refunds | monetization data source; **needs projectId stamping for app revenue attribution** |
| **Resend** | runtime adapter `email.send` | single-message email for generated apps | platform | UNVERIFIED live | — | metered | could back lifecycle email; **no lists/segments/unsubscribe** |
| **Twilio** | runtime adapter | sms/whatsapp send | platform | UNVERIFIED live | — | metered | same caveat |
| **Firebase/Mapbox/Cal.com/Cloudflare/ElevenLabs** | runtime adapters | notifications/maps/calendar/vectorize/voice | platform | UNVERIFIED live | — | metered | peripheral |
| **Nodemailer SMTP** | `lib/email/**` | transactional (verify/reset) | platform | PARTIAL | — | — | not campaign-capable |
| **GitHub** | `lib/integrations/github/**`, `lib/auth/github.ts` | OAuth, repos, push generated code | **user OAuth token (plaintext on users doc)** | PARTIAL | — | — | repo export of marketing sites; token handling needs fix (§10) |
| **Google OAuth** | `lib/auth/google.ts` | login only | platform | PARTIAL | — | — | — |
| **@vercel/analytics** | `app/layout.tsx` | passive page analytics, platform site | platform | VERIFIED mounted | — | — | **does not cover generated apps** |

**Explicit non-existence (do not invent):** NO advertising-platform integrations (zero ad SDKs/APIs), NO social-media publishing, NO email-marketing provider, NO CRM, NO web-analytics provider for generated apps, NO Google Search Console / rank data, NO experiments infrastructure.

**Classification:** Fully implemented (code-verified): Dodo billing, Firecrawl crawl, OpenRouter AI, Totalum, SMTP, GitHub push, runtime gateway. Implemented-but-unverified-live: all runtime adapters except OpenRouter/Firecrawl paths exercised in tests. Extendable infra: adapter registry ("adding a provider must become boring"), metering/pricing stack, pending-action approvals, `webhook_events` idempotency, `project_github` connection template. Would-need-integration: ad platforms, social publishing, GSC, an analytics provider or self-built ingestion. Should-remain-provider-agnostic: AI model routing, payments (adapter pattern).

---

## Section 9 — Analytics and metric availability

**The decisive fact:** Atai has no pipeline by which a *generated app's* traffic, sign-ups, conversions, or completed purchases reach Atai. Everything about "website visitor metrics" is therefore unavailable today. The only project-attributable time series are: `runtime_usage` (capability calls incl. **checkout-created** counts), `publish_events`, `build_runs`, `credit_ledger` (Atai-side), `projects.deploymentHistory`.

### Metric availability matrix

| Metric | Business definition | Required source | Existing source & location | Trustworthy today? |
|---|---|---|---|---|
| Visitors | unique app visitors/period | generated-app traffic events | none (`@vercel/analytics` = platform site only, `app/layout.tsx:250`) | **NO — unavailable** |
| Traffic sources | session → referrer/UTM channel | app events + UTM capture | none | NO |
| Sign-ups | new app customers | app-side account events or DB rows | raw Totalum DB readable (`app/api/projects/[id]/database/**`) but no schema convention, no scope on auto keys, no consent model | NO (raw tables only, UNVERIFIED attribution quality) |
| Activation / onboarding completion (app users) | first key action | event contract | none | NO |
| Conversion rate | defined numerator/denominator + window | visitors + conversions | neither exists | NO — cannot be computed |
| Paying customers (generated app) | distinct paying end-customers | payment events w/ project attribution | Dodo webhook handles payments solely for Atai credit grants via `metadata.userId`; no branch maps generated-app payments→project; nothing stamps projectId at checkout (`adapters/dodo/mapper.ts:44–75`) | NO |
| Checkout attempts | createCheckout calls/project | runtime_usage | YES — `{projectId, capability:"payments"}` records | **YES (narrow: creation, not completion)** |
| Revenue / MRR (generated apps) | completed payments value | Dodo webhook + projectId stamping | none per project | NO |
| MRR / revenue (Atai platform) | subscription revenue | `subscription_records`, `payment_records`, admin billing overview | VERIFIED working | YES — **but that is Atai's business, not the founder's** |
| CAC | spend / new customers | ad spend + customers | neither | NO |
| CPL / CPA | spend / leads / acq | spend + events | neither | NO |
| LTV | revenue/retention per customer | customers + payments | neither | NO |
| Churn / retention rate | cohort survival | customer events + periods | only platform-plan churn (`cancellation_feedback`, untyped/no index) | NO (platform churn only) |
| Campaign spend | provider-reported | ad platform APIs | no providers | NO — EXTERNAL DEPENDENCY |
| ROAS | revenue/attribution + spend | both above | neither | NO |
| Organic search traffic / search visibility | GSC data | Search Console API | not integrated | NO — EXTERNAL DEPENDENCY; do not display estimated rankings as facts |
| Email engagement | sends/opens/clicks | marketing email provider + events | transactional SMTP only; no campaigns | NO |
| Referral conversions | referrals→signup→activation | referrals collection | **YES** — real, fraud-flagged, per-Atai-user | YES (platform scope) |
| AI usage/credits per project | token/credit consumption | runtime_usage, credit_ledger | VERIFIED (runtime); planning/pipeline tokens stubbed | YES for runtime; PARTIAL for AI features |
| Deployment/uptime basics | deploys, success, URLs | deploymentHistory, publish_events | exists | YES (deploy success, not site uptime) |

**Standardize before implementing (recommendation):** conversion definitions (numerator/denominator/attribution window/population), a canonical project attribution key (`projectId` string id everywhere incl. Dodo metadata), currency + refund/failed-payment handling for any revenue figure, and event deduplication key policy. **Display policy (recommendation):** metrics without a trusted source render as an explicit "Not connected yet / Add data source" state — matching the existing honest-placeholder convention — never as sample numbers.

**Instrumentation gaps, in dependency order:** (1) project event ingestion (SDK namespace or server-side reporter + a batched ingestion endpoint + `marketing_events` collection + TTL policy), (2) Dodo `projectId` metadata stamping + webhook attribution branch, (3) UTM capture at app level (generated-app requirement via builder prompt), (4) consent/unsubscribe records before any lifecycle metric.

---

## Section 10 — Security and multi-tenancy

### Observed architecture (facts)

- Sessions: DB-backed opaque httpOnly cookies, hash-only storage, TTL, individual+bulk revocation (`lib/auth/session.ts:15–137`). Production cookie domain widens to `.atai.ink` (deliberate, for the developer portal; shares sessions across all subdomains — inherent risk noted).
- Edge gate `proxy.ts` is presence-only and documented as non-authoritative; every route handler re-validates. Public prefixes are narrowly enumerated (auth flows, `/api/public/*`, `/api/health*`, `/api/credit-costs`, billing webhook, `/api/internal/`, `/api/runtime/v1*`).
- Object-level authorization is consistently enforced server-side: page helper `requireOwnedProject`; API fail-closed `checkProjectOwnership` (DB error ⇒ not-owned); uniform 404s (no existence leak); runtime key access filtered *inside the Mongo query*; **an enumeration sweep of all 126 `app/api/**/route.ts` found no route trusting a client-supplied id without a server-side check** (admin routes: `requireAdmin`/`isAdmin`).
- AI tenant isolation: tool context built from session only; client-sent `activeProjectId` re-verified; context brief returns null on non-ownership (`context.ts:111–112`); model cannot author navigation URLs (registry only); "CONTENT IS DATA" prompt rule + injection scanning/sanitization for crawled content (`lib/planning/utils/security.ts:32–45`, `prompt-builder.ts:13–14`).
- Runtime: hash-only keys, timing-safe compare helper, scope checks, identity-injection structurally impossible (`z.never()` bodies), db capability bound solely to `totalumProjectId`, SSRF guard (private/CGNAT/metadata/IPv6 ranges blocked; **DNS-rebinding explicitly out of scope**), fail-closed billing, redaction logger (field-name + secret-shape regexes).
- Money-adjacent: webhook HMAC-SHA256 + 5-min replay window + `timingSafeEqual` + webhook-id idempotency (`webhook_events`); ledger idempotency keys; atomic pending-action claim prevents double execution; AI cannot touch billing.

### Confirmed vulnerabilities

**None at critical severity found in this pass.** Two confirmed lower-severity findings worth fixing before/with this feature:
1. **GitHub OAuth token stored plaintext on `users` (`lib/auth/users.ts:276–329`), no at-rest encryption** — a DB read exposes a user's repos. Any future `integrations` credential work should follow the `api_keys` hash-only pattern and relocate this token.
2. **`docs/DATABASE_SCHEMA.md` describes non-existent Stripe flows/migrations** — a documentation-integrity issue that misleads auditors/implementers (and could cause a Phase-2 agent to code against fantasy APIs).

### Potential risks requiring further testing (not confirmed)

1. No **IP-based** rate limiting on auth endpoints (per-email only) — email-rotation brute force unthrottled per-IP.
2. Public endpoints (`/api/public/feedback`, `/api/public/stats`, `/api/explore`) show **no rate limiting**.
3. **No account-deletion endpoint** found despite `destroyAllSessionsForUser` + GDPR-ish docs — before a workspace ingests end-customer data, deletion/retention must exist.
4. `/api/internal/*` shared-secret compare is not constant-time (fail-closed if unset — mitigating).
5. **Empty `scopes[]` = full capability access** convention (`authorize.ts:27–31`) — a footgun when issuing marketing integration keys.
6. CSRF relies on `sameSite=lax` + JSON bodies (no token) — adequate for current surface; re-evaluate if new authed POST-heavy surfaces appear.
7. Platform-side Firecrawl crawler doesn't call the SSRF guard (mitigated: fetching happens on Firecrawl's cloud) — re-check if self-hosted crawling is ever introduced. **When the SEO workspace analyzes user-supplied URLs, route through the guarded runtime path.**
8. Marketing-specific concerns (all NOT YET EXPOSED, must be designed in): ad-spend ceilings and emergency-stop; per-project isolation of any user-connected ad/social credentials; **prompt injection via crawled competitor pages into marketing agents** (existing defenses cover build-time crawling; extend to any new marketing crawl); consent/unsubscribe enforcement **server-side at send time**, not UI-hinted; bulk customer-operation approval (HARD_CONFIRM equivalent); abuse of a future public event-ingestion endpoint (spoofing/volume) — needs its own threat model.

**Approval/audit mechanisms required before:** publishing public content, sending marketing communications, launching ad campaigns, raising budgets, modifying live pricing/billing, bulk customer operations — all of which map onto the existing `cofounder_pending_actions` risk-ladder pattern; the platform has **no other** approval substrate and should not build a parallel one.

*No secrets or customer data are included in this report; env var names only.*

---

## Section 11 — UX and design-system findings

**Design system:** shadcn/ui on Tailwind v4; oklch CSS-variable tokens with light/dark + brand tokens (`app/globals.css`); `cn()` util; lucide-react icons; sonner toasts (react-hot-toast is a dead dep — 0 imports). 16 primitives (`components/ui/`): button, card, dialog, alert-dialog, tabs, badge, skeleton, etc. **Missing for this workspace:** table primitive, select/date-picker, **any chart/data-viz library** (zero chart deps — must add one, ideally shadcn-conventional, as a dependency decision), form library (none — hand-rolled + server zod is the house style; keep consistent).

**Reusable building blocks:** `components/runtime-control/*` is the closest template for data-heavy marketing pages (cursor-paginated tables, breakdown cards, filters, request detail, CSV export, health); `components/cofounder/action-cards.tsx` for AI-proposal approvals; `credit-meter`/`project-card`/`state-badge`/`command-center` metric patterns; `skeleton.tsx`, coming-soon empty states, `env-manager.tsx` for a future integrations/settings page. Accessibility: 64 files with aria attributes, focus rings, drawer with `aria-modal` (code exists; not verified with a11y tooling).

**Recommended information architecture (reasoned, no redesign performed):**
- Keep the **project-level** model: activate the six reserved `workspaceGrowNav` slots rather than adding top-level nav — the workspace is already project-contextual and ownership wiring exists per route.
- Suggested mapping: Growth overview → `/project/[id]/market`; AI Marketing Studio + Campaigns & Ads → `/project/[id]/ads` (tabs: Studio / Campaigns / Ads — sub-views via `components/ui/tabs`, sidebar already at 11 items, avoid deeper nesting); Monetization → `/project/[id]/finances` (Atai platform billing stays in `/settings/billing`); Customers & Retention + Analytics & Experiments → one tabbed page (both are event-data consumers; merging avoids nav sprawl until traffic exists); Growth tasks → surface inside Growth overview (task list = the co-founder's prioritized next steps, not a separate destination); Competition keeps its slot; Settings & integrations → extend `app/settings` pattern + per-project connections modeled on `env-manager.tsx`.
- AI Marketing Studio must integrate with, not duplicate, the two existing AI surfaces: the global `CofounderPanel` (general assistant) and the project-scoped Collaborate chat (build plan). Recommendation: marketing actions register as **co-founder tools + pending actions** (one approval substrate), with studio pages as structured workspaces the panel can *navigate to* via `lib/navigation/routes.ts` targets.
- All unavailable data uses explicit "not connected" empty states (existing convention). Premium-clean SaaS direction is achievable with the current token system; charts are the one new visual primitive required.

---

## Section 12 — Testing, performance, and reliability

**Tests:** Vitest 5, **77 files**, strong in depth where present: runtime authz/keys/rotation/metering/concurrency, SSRF, SDK security (incl. static scan for credential leakage + key-never-in-error assertions), billing checkout/idempotency, planning retry/circuit-breaker/sanitizer/parsers, tool registry, navigation registry, ownership fail-closed, proxy edge-gate regressions. Only 5 of ~126 route handlers have route-level tests. **Not covered:** cross-tenant route-level isolation (unit-level only), webhook HMAC verification (no test file — gap), 10 of 11 runtime adapters, DB integration (no live Mongo), UI components (no jsdom/RTL), e2e, responsive behavior.
**CI/CD: none** — no `.github/workflows`, no `vercel.json`; tests only run manually (`pnpm test`). This is the single largest process gap; any Phase-2 plan should introduce a CI gate before marketing code (which touches money, credentials, and external publishing) lands.

**Runtime characteristics relevant to marketing workflows:**
- No queue/scheduler/cron/worker anywhere (verified). Only mechanisms: fire-and-forget promises in route handlers + client polling status sync + Mongo TTL + lazy read-path sweeps + process-local locks (single-instance only; Redis recommended in-file but absent).
- Per-provider timeouts env-tunable (OpenRouter 60s, Totalum 30s, AbortSignal 120s plan-chat); planning retries w/ classification + backoff; circuit breaker implemented but **no call sites** (appears unused).
- Concurrency: fail-fast in-process 32 (runtime); fixed-window Mongo rate limiters; per-project tighten-only caps.
- Caching: single-flight dedupe (`lib/cache/single-flight.ts`), Firecrawl 7-day cache; no general result caching layer.
- Pagination: cursor-based in runtime usage/requests; project lists capped.

**Sync vs async (recommendation grounded in evidence):** synchronous-safe today: Firecrawl-backed SEO checks & competitor snapshots (cached), single content generations (<60s), single email/SMS sends, analytics *reads* over existing collections. **Requiring new infrastructure (Category E):** scheduled content publishing, bulk campaigns, multi-page crawls, ad-platform syncs, experiment aggregation — a job table + worker (or hosting-provided cron/queue) is a hard prerequisite; also accidental-double-execution protection (idempotency keys per campaign run, mirroring `credit_ledger`/pending-action precedents) and user-visible job status (precedent: project `events[]` stream + polling).

**Phase-2 test strategy (minimum):** cross-tenant marketing-object access (campaign/content/event rows of another user's project → 404), unauthorized credential access, approval-gate enforcement (execution without approval must be impossible), metric calc fixtures (definition-stable), stale/missing analytics rendering, failed-provider retry + duplicate-webhook handling, idempotent execution, spend-limit enforcement, consent/unsubscribe enforcement at send time, background-job retry/recovery, generated-app SDK compatibility smoke (scope matrix incl. `PROVISIONED_KEY_SCOPES`), plus regression on dashboard/project flows (the app-builder core must not break).

---

## Section 13 — Complete gap analysis

### Category A — Reuse as-is
| Item | Evidence | Notes |
|---|---|---|
| Co-founder agent + tool registry + pending-action approvals | `lib/cofounder/**` | THE action substrate; risk ladder; atomic claim; audit trail |
| Credit ledger + reserve/refund + idempotency | `lib/billing/credit-service.ts`, `lib/credits/credits.ts` | Charge marketing actions with `referenceType` |
| `runtime_usage` metering + admin pricing rules + export | `lib/runtime/metering/**` | Usage/cost attribution for marketing API calls |
| Firecrawl client/cache + SSRF guard | `lib/integrations/firecrawl/**`, `adapters/shared/ssrf.ts` | Data acquisition for SEO/competitor snapshots |
| Model registry + retries + zod-output pattern | `lib/planning/**`, `lib/analysis/model.ts` | Add marketing stages, not a new AI stack |
| Reserved routes/nav slots + ownership gating | `atai-nav.ts:58–67`, `app/project/[id]/*` placeholders | Flip "soon"→live incrementally |
| `project_assets`+ImageKit, generate-visual | `app/api/projects/[id]/generate-visual` | Creative-asset engine already priced |
| Referral system | `lib/referrals/**` | Only live growth loop |
| Runtime control-center UX patterns | `components/runtime-control/*` | Tables/pagination/filters template |
| Platform billing data (Atai revenue) | `payment/subscription_records` | For platform-side BI only |

### Category B — Extend
| Item | Change needed | Effort |
|---|---|---|
| Navigation registry | add marketing targets + tests (`lib/navigation/routes.ts`) | XS |
| Tool registry | marketing tools (draft content, create campaign, run SEO audit, read metrics) honoring risk ladder | S–M each |
| Pending actions | generalize or reuse for campaign approval/scheduling records | S |
| Dodo checkout flow | stamp `projectId` in metadata + webhook attribution branch → app revenue events | S |
| Runtime capability set | `events.track` (+ batched op) via contract/adapter/SDK/metering; **requires zero-price rule** since unpriced ops are denied | M |
| Provisioned key scopes | widen `PROVISIONED_KEY_SCOPES` policy (decision + backfill path for existing keys) | S–M |
| Feature-request pattern | lift into generic marketing task system (status history, notes, assignee) | M |
| `cancellation_feedback` | type + index it; becomes churn-reason data source | XS |
| Coming-soon pages | replace with real pages behind flags | M–L each |

### Category C — Build new (net-new, no evidence of existence)
- Growth overview page + metric aggregation service over *available* sources (S; honest-partial with "not connected" states).
- Campaign model + CRUD + status/lifecycle (M). Content studio: drafts/versions/calendar/templates (L). SEO audit engine over Firecrawl data: checks/scoring/history (`seo_audits` durable) (L). Event ingestion + `marketing_events` + retention policy + dedup (L, also B/D). Customer/lifecycle layer incl. consent + unsubscribe enforcement (L; privacy-first design). Experiments (L; depends on events). Marketing AI agents: strategist/copywriter/SEO-auditor built on ModelRegistry + generateText+zod pattern (M each; recommend *capabilities behind tools*, not new chat UIs). **No false-precision confidence claims — effort from evidence of analog modules; XL items flagged by dependency depth.**

### Category D — Integrate externally (all currently absent)
- Ad platforms (Google/Meta/TikTok/X Ads): none exist; OAuth credential flows, spend APIs, reporting webhooks — **L–XL each, EXTERNAL DEPENDENCY REQUIRED, treat spend as sensitive**.
- Social publishing APIs: none — L each.
- Google Search Console / rank data: none — M (rank *history* still needs a real data source; do not substitute estimates).
- Third-party web analytics (GA4/Plausible/Matomo) as an optional *connected* metric source instead of self-built ingestion: M integration vs L build — **open decision, Section 16**.
- Marketing email provider w/ lists+unsubscribe (vs Resend single-send): M — or build send-time consent checks on existing Resend/SendGrid-class infra.
- CRM: none; likely unnecessary if lifecycle layer is native — defer.

### Category E — Resolve before implementation
1. **Background-job infrastructure** (or adopt hosting cron/queue) — blocks scheduling, bulk ops, retries. Without it campaign "execution" is dishonest. (M)
2. **Analytics/metric trust policy + definitions standardization** (§9) — blocks dashboard from showing anything numeric. (S, mostly decisions)
3. **Consent/unsubscribe + data-deletion story** — required before any customer-contact feature; currently absent. (M)
4. **Credential model for user-connected providers** (new `integrations` collection per `api_keys` pattern; move GitHub token; ban empty-scope keys for new features). (M)
5. **CI pipeline** before money/credential-touching code. (S–M)
6. **Fix stale docs** (`DATABASE_SCHEMA.md`) so Phase 2 isn't built on fiction. (XS)
7. **Public-endpoint + IP rate limiting, webhook-HMAC tests, circuit-breaker wiring** — hardening items found (§10, §12). (S)

### Category F — Defer intentionally
Advertising execution + spend automation (until a provider + approval + budget-cap + kill-switch design exists end-to-end); social publishing (per-platform API approvals); true A/B experimentation with statistics (needs events + allocation + engine); generated-app *customer* analytics (needs consent + app-side contract; start with platform-side + checkout-attributed data); report export/scheduling (needs job infra); multi-user teams (RBAC does not exist by design and is out of scope); organic rank history (needs GSC).

---

## Section 14 — Dependency-aware implementation roadmap

**Phase 0 — Foundations (blocks everything; ~Cat-E 1–7):** CI gate; job infrastructure decision; metric-definition + trust policy; feature-flag mechanism (none exists today beyond `USE_ENHANCED_PIPELINE` env pattern — reuse that convention); `integrations` credential model; docs fix. *Acceptance: CI green; a scheduled job demonstrably runs+retries; empty-scope keys impossible for new surfaces.*

**W1 — Workspace skeleton & project context (prereq: Phase 0 flags).** Activate `market` page shell in reserved slot: read-only Growth overview showing *trustworthy* data only (deployment status/URL, runtime usage incl. checkout-creation counts, referrals, credit spend, onboarding goals, spec marketing/SEO/growth prose surfaced as "AI plan, not yet executed"), explicit "not connected" states, nav targets registered, co-founder tool `get_growth_overview` (READ). *Acceptance: cross-tenant isolation tests; zero fabricated metrics rendered.* Reuses: view-model pattern (`lib/workspace`), runtime-control components, `project-actions` conventions. Effort M.

**W2 — SEO & Visibility v1 (prereq: W1; Firecrawl reuse).** Durable crawl-based audits (metadata/headings/sitemap/robots/indexability-adjacent checks) for the project's deployed URL + competitor URLs; `seo_audits` history; findings scored by existing zod pattern; AI recommendations clearly labeled generated vs observed; `run_seo_audit` CONFIRM-tier tool (costs credits). Guarded URL handling mandatory. *Acceptance: audit reproducibility; no ranking claims.* Effort L. (Order moved ahead of Campaigns because it needs no new provider, no consent layer, and no scheduler beyond a single bounded crawl.)

**W3 — AI Marketing Studio v1 (prereq: W1).** Drafts/versions/collections on `content_items`; generation via ModelRegistry + credit charging + refund discipline; brand voice from `specification.brandIdentity`; templates; save/edit only, **no publishing**; publish/scheduling deferred until jobs (W4/W5). Reuse generate-visual for creatives. *Acceptance: ownership isolation; credit accounting; content distinguished from spec prose.* Effort L.

**W4 — Growth tasks & execution management (prereq: Phase 0 jobs, W1–W3).** Feature-request-pattern task store; AI-generated next-steps → tasks (proposal→approval via pending actions); due/priority/status + history; dashboard next-step card integration. *Acceptance: task lifecycle e2e; approvals un-bypassable server-side.* Effort M.

**W5 — Campaigns (planning→scheduling→execution) & attribution (prereq: W3, W4, jobs).** `campaigns`+`campaign_executions` (build_runs lifecycle model); objectives/channels/budget *tracking* (not ad spend); email execution **only after** consent infra; UTM conventions + `projectId`-stamped Dodo checkout + webhook attribution branch (small, high-value); campaign→metric links from whatever sources exist. *Acceptance: idempotent execution; pause/cancel; duplicate-webhook safety.* Effort XL total; email path L conditional on W6.

**W6 — Customers/lifecycle & monetization analytics (prereq: events decision + consent design; partly D).** Event ingestion capability (batched, zero-priced rule, retention policy) *or* connected-analytics-provider integration (decision, Section 16); then sign-up/activation/funnel metrics; then pricing/monetization workspace (`finances` page): generated-app revenue (from attributed events), churn/LTV *once* customer identity exists, pricing recommendations as recs-only (no live pricing mutation without approval design). Effort L–XL; explicitly gated.

**W7 — Monetization Lab recs layer (prereq: W6 data or spec+onboarding context alone).** Pricing/model recommendations from project stage + usage data where available; clearly AI-labeled; integrates Collaborate `pricingTiers` sections. Can start as a thin W1-dependent rec-engine if W6 slips. Effort M.

**W8 — Advertising (only when a provider is committed).** Connect→approve→spend-ceiling→kill-switch→reporting loop; HARD_CONFIRM on every spend-affecting tool; account isolation per project; emergency stop. Effort XL, EXTERNAL. Defer until W5 approval/scheduling proven with non-spend channels.

**W9 — Experiments & BI/reporting (prereq: W6 events + W5 campaigns).** Funnel/retention dashboards, cohort basics, report generation/export (reuse runtime export pattern), then statistically-sound experiments (allocation+outcomes) — only with genuine event volumes. Effort L–XL.

**W10 — Hardening & refinement (continuous, final gate).** Security verification (tenant matrix, SSRF on new crawl paths, prompt-injection on marketing prompts), perf of large event queries, a11y pass, responsive QA, regression suite on builder/hosting/billing flows, docs refresh.

*(Order differs from the brief's suggested sequence per the "dependency-driven" requirement: SEO/content/tasks precede execution/analytics because they need no external providers, no consent layer, and no event pipeline.)*

---

## Section 15 — Regression and compatibility risks

| Existing function at risk | Why | Protection |
|---|---|---|
| **Project creation + build pipeline** (the product core) | Marketing features reuse `project-actions`, credits, and could re-enter create flows | No changes to `create-project.ts` semantics; feature flags; keep marketing mutations additive; regression tests on `/api/projects/*` |
| **Collaborate (2,328-line client) & plan sections** | Studio could tempt changes to shared plan components | New components; do not edit `collaborate-client` beyond nav links; `plan-sections.ts` registry untouched (marketing data in new collections) |
| **Auth/session + cookie domain** | New subdomain surfaces (e.g. tracking endpoints) interact with `.atai.ink` cookies | Public ingestion must be cookie-less/Bearer-only like `/api/runtime/v1`; extend `proxy.ts` whitelist deliberately + regression tests |
| **Runtime gateway contracts** | `events.track` addition touches `RuntimeRequestSchema`/capability registry | Strictly additive entries; existing router tests as guardrails; no body-relaxation ever |
| **Auto-provisioned key scopes** | Widening `PROVISIONED_KEY_SCOPES` changes least-privilege posture of every existing generated app | Versioned provisioning policy; per-project opt-in; audit which apps need which scopes — security review required |
| **Dodo checkout/metadata** | Stamping projectId changes webhook payload shapes | Backward-compatible metadata (additive keys); webhook fixture tests; `webhook_events` idempotency preserved |
| **Credit ledger integrity** | New `referenceType`s flow through reserve/charge/refund | Reuse exactly; idempotency keys; no new balance fields; admin reconciliation page regression |
| **`projects` doc size** | Fat embedded doc; tempting to embed marketing data | Hard rule: link by `projectId` in new collections (102 existing indexes assume current shape) |
| **planning_runs / firecrawl_cache TTLs** | Repurposing them for durable evidence conflicts with expiry | New collections instead; leave caches/caches-with-TTL untouched |
| **Generated apps in the wild** | Apps already built assume SDK contract | SDK changes additive only; zero-dep promise kept; no breaking capability renames |
| **Dashboard shell/nav** | Sidebar changes affect every user | `kind:"soon"`→`"link"` is a data change in `atai-nav.ts`; visual regression on `workspaceGrowNav` tests if added |
| **Uncommitted working-tree changes** (pricing/sdk/docs-content etc. present at audit time) | Another agent may be mid-task | Phase 2 must re-check `git status` and coordinate before touching those files |

---

## Section 16 — Open questions and unknowns

1. **Metric strategy: self-built event ingestion vs connecting an existing analytics provider (GA4/Plausible) per project.** Repo evidence: neither exists; ingestion needs new key tiers/scoping/volume design; provider integration needs user OAuth (a new credential model Atai doesn't have). Affects W6 entirely. **Needs a product decision.**
2. **Whose customers are the "customers"?** Atai's own users (data exists: users/credits/referrals/subscriptions) vs generated-app end-customers (no access/consent today). The workspace brief mixes both; architecture differs sharply. Recommend explicit split in UI/data.
3. **Auto-provisioned key scope policy** — is widening `["ai.text"]` acceptable, and do existing deployed apps even *use* `db`/`payments` today? UNVERIFIABLE from repo; needs Totalum-side inspection or live-app audit.
4. **Generated-app revenue completion data availability** — Dodo dashboard/account may hold app payments under Atai's platform account without project tags; repo evidence shows no attribution. Can completed purchases be recovered/mapped retroactively? Needs provider-side check (not performed).
5. **Are the existing "VERIFIED WORKING" flows actually live in production?** (build/deploy via Totalum, Dodo live mode, OpenRouter quota posture). No deployment/provider access was available; docs conflict (`CURRENT_STATUS.md` vs code). Phase 2 should smoke-test the rails it builds on.
6. **Totalum capabilities relevant to hosting marketing features** (custom domains for landing pages? edge analytics? cron?) — external, documentation pending in several client methods. Blocks W2–W5 design details.
7. **Feature-flag mechanism** — no flags system exists; only env + percentage-rollout hash pattern. Decide: adopt that pattern formally or build minimal flag store.
8. **Multi-tenancy future:** single-owner `userId` model everywhere; if team/multi-member projects are planned, membership layer precedes most marketing collaboration features. (No evidence either way in repo — product question.)
9. **Email domain/sender reputation + unsubscribe compliance** for any Atai-sent lifecycle mail — no evidence of a sending domain policy beyond transactional SMTP config. Regulatory, not just technical.
10. **`react-hot-toast` dead dependency and other drift** (stale docs, missing cleanup script) — housekeeping ownership, harmless to feature but indicates doc-drift risk generally.

---

## Section 17 — Final readiness assessment

**Can implementation begin safely?** **Yes for a scoped subset; no for the full brief as written.**

- **Ready now (foundation proven in code):** W1 growth-overview shell surfacing only trustworthy data; W2 SEO audits (guarded crawl + new durable collection); W3 content studio (drafts only); navigation/tool/flag wiring; task system. These reuse VERIFIED substrates (approvals, credits, Firecrawl, model registry, nav slots) and create no external dependencies.
- **Blocked on decisions:** event/analytics strategy (Q1/Q2), key-scope policy (Q3), email-compliance posture (Q9).
- **Blocked on missing infrastructure:** anything scheduled or bulk (no job system), any customer contact at scale (no consent/unsubscribe), any ad/social execution (no providers), experiments (no events).
- **Must-fix first (small):** CI gate, `DATABASE_SCHEMA.md` staleness, `cancellation_feedback` typing, rate-limit hardening on new public endpoints, GitHub-token relocation when credentials work starts.

The single most important readiness fact: **the platform's rails are excellent; the workspace's raw material (project/business data about end customers and traffic) largely does not exist yet.** Phase 2 must design for empty states and instrumentation growth, and must not let a marketing dashboard imply measurements Atai cannot make.

## Section 18 — Handoff for Phase 2

**Read first (authoritative — this report, not `docs/DATABASE_SCHEMA.md`):** §2 map, §7 collections, §6 agent/runtime, §10 security, §13 gaps, §14 roadmap.

**Reuse verbatim:** `lib/cofounder/tool-registry.ts` + `lib/cofounder/pending-actions.ts` (add marketing tools; never execute without approval claim); `lib/projects/project-actions.ts` (mutation + credit + 404-pattern); `lib/billing/credit-service.ts` (charge/refund with `referenceType`); `lib/analysis/model.ts` `MODEL` + `lib/planning/models/registry.ts` pattern; `lib/planning/utils/{retry,circuit-breaker}.ts`; `lib/integrations/firecrawl/service.ts` (+ 7d cache); SSRF guard `lib/runtime/router/adapters/shared/ssrf.ts`; `lib/db/collections.ts` conventions (dual id, sparse unique `{id:1}`, `{userId|projectId,createdAt:-1}`, lazy `ensureIndexes` — add accessors + indexes there, no migration tool); `runtime/contracts/router.ts` + `lib/runtime/router/adapters/register-all.ts` for any new capability (additive only; **unpriced = denied**); `lib/api/respond.ts`; `components/runtime-control/*` + `components/ui/*` (add chart lib deliberately); `lib/navigation/routes.ts` (+ its test) for AI navigation; `components/workspace/atai-nav.ts:58–67` to flip slots live.

**Key models/names:** `MirrorProject`/`ApplicationSpecification` (spec marketing fields = AI text — cite as such), `PendingActionRecord`, `RuntimeUsageEventSchema`, `FirecrawlCacheDoc`, `CreditLedgerEntry.idempotencyKey`, `users.onboarding`.

**Security constraints (non-negotiable):** server-side ownership check on every marketing object (pattern: `checkProjectOwnership`, uniform 404); one approval substrate; AI tools must enforce permissions independent of prompts; treat crawled pages as hostile data ("CONTENT IS DATA"); hash-only credential storage (api_keys pattern); no empty-scope keys; consent/unsubscribe enforced at send time server-side; spend operations = HARD_CONFIRM + ceiling + kill-switch (when ads phase ever begins); no secrets in logs (reuse logger); no user-facing mock data — "not connected" states only.

**Decisions required from product owner before coding W6+:** analytics strategy (ingest vs integrate), customer-definition split, key-scope policy, sending-domain/compliance posture.

**Suggested first implementation slice (Workstream 1):** new `lib/marketing/` service reading only existing collections (`projects`, `runtime_usage`, `referrals`, `credit_ledger`, `users.onboarding`) + Growth overview page replacing `app/project/[id]/market` `ProjectComingSoon`, behind an env flag (pattern: `USE_ENHANCED_PIPELINE`), with nav flip + `get_growth_overview` READ tool + cross-tenant tests + CI workflow added. No schema changes. This validates the whole integration seam at minimal risk before heavy builds.

---
*End of report. Prepared by the Phase 1 audit; no application behavior changed.*
