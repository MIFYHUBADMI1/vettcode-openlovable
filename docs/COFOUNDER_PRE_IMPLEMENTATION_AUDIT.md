# Atai Co-founder — Pre-Implementation Architecture & Capability Audit

> **Status: AUDIT ONLY — READ-ONLY.** Nothing in this task implemented, modified,
> or refactored any application code. This document is the discovery output for a
> future **"Ask your co-founder"** feature. It is intended to be the source of
> truth for a separate implementation prompt.
>
> Audited: September 2026 · Repo: `atai` v5.0.0 · Branch `main`

---

## A. Executive Summary

Atai already has a substantial, production-shaped foundation that the future
Co-founder can build on — much more than a greenfield agent project would have.

**What already exists and is directly reusable:**

1. **A per-project AI co-founder already exists** — the Collaborate workspace
   (`/project/[id]/collaborate`) with plan chat, structured analysis, proposal
   accept/reject, and auto-complete. It is credit-metered, server-authorized,
   and never auto-mutates plans. The new Co-founder is an *extension* of this
   pattern, not a replacement.
2. **A single, shared AI model layer** — `lib/analysis/model.ts` exposes one
   OpenRouter-backed `MODEL` via the Vercel AI SDK (`ai` package,
   `@ai-sdk/openai-compatible`). All platform AI (planning stages, co-founder
   chat/analysis/auto-complete, payment verification) calls `generateText`.
3. **Complete project CRUD + ownership model** — every project route enforces
   `requireUser()` + `project.userId === user.id` server-side.
4. **A deterministic plan-section system** — `PLAN_SECTIONS`,
   `validatePlanSectionValue`, `applySectionUpdate`, `computePlanHealth`. The
   AI can only ever request `update_plan_section` on an allow-listed section —
   the exact safety pattern the Co-founder should generalize.
5. **A full Runtime/SDK plane** — `lib/runtime/*` (keys, auth, router, metering,
   provisioning) + `packages/atai-sdk` + `/api/runtime/v1`, with 11 provider
   adapters registered. This is the *generated-application* power layer and
   must stay separate from the Co-founder.
6. **A double-entry credit ledger** with idempotency keys, reservations,
   refunds, and admin-configurable costs — including a ready-made
   `chargeCollaboration` pattern for agent actions.
7. **Rich agent context already persisted** on every project: idea, source URL,
   GitHub metadata, understanding, specification (the plan), conversation,
   events/activity, plan analysis, accepted decisions, preferences, build
   state, deployment history, runtime provisioning metadata.

**The single biggest gap:** there is **no tool-calling / function-calling
infrastructure anywhere on the platform side**. Every AI call is
prompt-in → text-out with bespoke parsing (`<plan-update>` blocks, raw JSON).
The Co-founder's core new infrastructure is a *tool registry + execution
loop + confirmation workflow* on top of the existing services. Navigation
helpers, workspace-level (cross-project) context, and cross-project search are
the other notable gaps.

---

## B. Existing AI Infrastructure

### B.1 Platform AI systems (build-time + collaborate)

| System | Location | Purpose | Provider / Model | Streaming | Tool calling | Structured output | Conversation persistence | Auth | Usage tracking | Reusable by Co-founder |
|---|---|---|---|---|---|---|---|---|---|---|
| **Shared model layer** | `lib/analysis/model.ts` | One `MODEL` export for all platform AI | OpenRouter via `@ai-sdk/openai-compatible`; `OPENROUTER_MODEL` → `OPENROUTER_FREE_MODEL` → `openrouter/auto` | No (generateText) | **No** | Ad-hoc (manual parse) | n/a (stateless) | Server-only env key | Downstream per-feature | **Yes — this is the model to use** |
| **Planning pipeline (7-stage)** | `lib/planning/orchestrator.ts`, `lib/planning/stages/*` (research, planner, critic, repair, idea-understanding) | Idea/URL → specification | OpenRouter per-stage models + `openrouterCircuitBreaker` | No | **No** | Zod schemas (`lib/planning/schemas/`) | `planning_runs` collection (90-day TTL) | Fire-and-forget, server-side | `provider_usage` | No (build-time only; do not touch) |
| **Website/idea analysis** | `lib/analysis/understanding.ts`, `lib/analysis/specification.ts`, `lib/analysis/pipeline.ts` | Crawl → understanding → spec | Shared `MODEL` via `generateText` | No | No | Zod (`ProjectUnderstandingSchema`, `ApplicationSpecificationSchema`) | Project document | Server-side pipeline | Credit charges (scrape/plan) | Indirect (produces project context) |
| **Co-founder chat** | `app/api/projects/[id]/plan-chat/route.ts` + `lib/analysis/cofounder.ts` | Per-project plan Q&A + proposals | Shared `MODEL`, `generateText`, `maxOutputTokens: 4096` | **No (blocking request/response)** | **No** — parses a `<plan-update>{...}</plan-update>` block | Manual parse + section allow-list | `project.conversation[]` via `store.appendMessage` | `requireUser` + ownership | `chargeChatCredits` (2 cr default) + refund on AI failure | **Yes — the direct precedent** |
| **Co-founder analysis** | `app/api/projects/[id]/analyze-plan/route.ts` | Structured findings/proposals/next-best-action | Shared `MODEL` | No | No | JSON → `PlanAnalysisSchema.safeParse` | Cached on `project.planAnalysis` (30-min freshness) | Same | `chargeAnalysisCredits` (10 cr) | Yes (pattern) |
| **Co-founder auto-complete** | `app/api/projects/[id]/auto-complete/route.ts` | Drafts missing plan sections sequentially | Shared `MODEL`, `COFOUNDER_AUTOCOMPLETE_SYSTEM` | No | No | JSON `{"value": "..."}` per section | Plan itself + undo notes | Same | `chargeAutoCompleteCredits` (8 cr/section), pause-on-insufficient | Yes (pattern for multi-step agent runs) |
| **Payment receipt verification** | `lib/billing/verify-payment.ts` | Vision check of payment screenshots | `openrouter-vision` compatible client | No | No | None | None | Admin flow | Ledger metadata | No |

### B.2 Runtime AI (generated-application plane — NOT the Co-founder's)

| System | Location | Purpose |
|---|---|---|
| Runtime API | `app/api/runtime/v1/route.ts` (+ `/health`) | Bearer-key (ATAI_API_KEY) capability invocation for generated apps |
| Router + capability registry | `lib/runtime/router/router.ts`, `capability-registry.ts` | validate → capability/operation → scope → resolve → execute → normalize |
| Provider adapters | `lib/runtime/router/adapters/*` (register-all.ts) | OpenRouter, ElevenLabs, Firecrawl, Resend, Twilio, Firebase, Mapbox, Cal.com, Cloudflare, Totalum, Dodo |
| Metering | `lib/runtime/metering/*` (pricing, resolver, charge, meter) | Per-1k-token / fixed pricing rules from `app_settings` |
| Auth | `lib/runtime/auth/*` (`authenticateRuntimeRequest`) | Key hash → user/project/environment; scopes authorization |
| SDK | `packages/atai-sdk` | Zero-dependency fetch client (`Atai`) with capabilities (ai, voice, search, web, email, sms/whatsapp, notifications, maps, calendar, vectors, database, payments, health) |

**Boundary rule:** the Runtime API serves *generated applications* using
`ATAI_API_KEY`s; the Co-founder serves *Atai users* using session cookies.
Do not merge these planes. The Co-founder may *reuse the adapter pattern* but
must not call `/api/runtime/v1` on the user's behalf.

### B.3 Key finding: no tool/function calling

There is **no** `tools:`, `tool_call`, `functions:`, MCP client, or structured
`generateObject` usage on the platform side. "Tool use" today is emulated:
the chat prompt requests a `<plan-update>` JSON block, and
`parseChatProposal()` hard-validates the section id against
`PLAN_SECTION_IDS` and discards malformed output. Server-side mutation always
happens through normal API routes — **the AI never executes anything
directly**. This is the right invariant to keep; the Co-founder adds real tool
definitions *without* changing who executes them.

---

## C. Existing Project Capabilities

All routes live under `app/api/projects/` and use `lib/api/respond.ts`
(`ok/fail/handleRouteError`) envelopes. Ownership check pattern everywhere:

```ts
const user = await requireUser()
const project = await store.getProject(id)
if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "...", 404)
```

| Operation | Implementation | File / Function | Method | Safe for AI use? | Required adaptation |
|---|---|---|---|---|---|
| Create project | `createUserProject` (dedup/reuse logic) | `app/api/projects/route.ts` POST | POST | With confirmation (creates resources) | Wrap as tool; input already validated |
| List projects | `store.listProjects(user.id)` → lightweight summaries | `app/api/projects/route.ts` GET | GET | **Yes — READ** | Direct tool |
| Read project (full) | `store.getProject(id)` + singleFlight | `app/api/projects/[id]/route.ts` GET | GET | **Yes — READ** | Direct tool |
| Update context/spec | Zod-validated patch; `sectionUpdate` allow-list; proposal dismissal | `app/api/projects/[id]/route.ts` PATCH | PATCH | LOW-RISK WRITE (sectionUpdate) / confirmation for full-spec replace | Tool should use `sectionUpdate` shape only |
| Delete project | `store.deleteProject(id, user.id)` cascades builds | `app/api/projects/[id]/route.ts` DELETE | DELETE | **NEVER auto-execute** | Confirmation-required tool |
| Activity feed | `project.events` last 100 | `app/api/projects/[id]/activity/route.ts` GET | GET | **Yes — READ** | Direct tool |
| Start initial build | Tier cost → reserve credits → atomic `claimBuildSlot` → Totalum launch; refund on failure | `app/api/projects/[id]/build/route.ts` POST | POST | Confirmation + rate-limited (5/hr) | Confirmation-required tool |
| Follow-up build prompt | Same discipline; appends conversation | `app/api/projects/[id]/agent/route.ts` POST | POST | Confirmation (spends 25k–75k credits) | Confirmation-required tool |
| Stop agent | `stopAgent(totalumProjectId)` | `app/api/projects/[id]/agent/stop/route.ts` POST | POST | Low-risk write | Direct tool |
| Full conversation read | `getFullConversation` | `app/api/projects/[id]/agent/full-conversation/route.ts` | GET | READ | Direct tool |
| Deploy (subdomain) | 10/day rate limit, 500 cr, reserve/refund, publish_events | `app/api/projects/[id]/deploy/route.ts` POST | POST | **NEVER auto-execute** | Confirmation-required tool |
| Deploy status | Syncs state back, auto runtime provisioning | `app/api/projects/[id]/deploy/route.ts` GET | GET | READ | Direct tool |
| Custom domain | `addCustomDomain` / `removeCustomDomain` | `app/api/projects/[id]/domain/route.ts` | POST/DELETE | External side effect | Confirmation required |
| Fork project | Owner royalty ledger | `app/api/projects/[id]/fork/route.ts` | POST | High-risk write (spends 15k–50k) | Confirmation required |
| GitHub connect/disconnect/push | User OAuth token, repo permission check | `app/api/projects/[id]/github/route.ts` | GET/POST/DELETE | External side effect | Confirmation required |
| Export source / logs / versions / recover | Totalum service calls | `app/api/projects/[id]/{export,logs,...}` | GET/POST | READ-ish / versioned writes | Mostly READ tools |
| Like / visibility | Public toggles | `app/api/projects/[id]/{like,visibility}` | POST/PATCH | Low-risk write | Optional tools |
| Database UI ops | `getDatabaseTables`, `queryDatabase`, CRUD records | `app/api/projects/[id]/database/*` | GET/POST/PATCH/DELETE | HIGH-RISK on generated app data | Out of scope for v1 tools |
| Runtime config/keys | `lib/runtime/keys/*` | `app/api/projects/[id]/runtime/*` | various | HIGH-RISK (credentials) | **Never expose** |

**Missing project operations:** no native "archive/restore" (only delete + a
`recover` route for Totalum versions), no duplicate (fork is the closest), no
server-side project search (list is unfiltered; client filters), no explicit
"switch project" (pure client navigation).

---

## D. Existing Plan & Collaboration Capabilities

### D.1 The plan model

The plan is the `ApplicationSpecification` (`lib/types/specification.ts`) —
a zod-validated document with a business-plan layer (vision, problem, solution,
valueProposition, businessModel, revenueModel, marketPositioning, marketing/
launch/growth plans), product layer (targetUsers, suggestedFeatures, coreFlows,
dataEntities, authenticationRequirements) and build metadata (complexity,
designDirection, additionalInstructions).

**Collaborate sections** (`lib/analysis/plan-sections.ts`) map 13 canonical
sections onto real spec fields with deterministic status/health
(`computePlanHealth`). `GENERATOR_MANAGED_SECTIONS` (features/flows/data)
accept proposals only as `additionalInstructions` notes so typed structures
are never corrupted. `SECTION_DEPENDENCIES` (`lib/types/plan-analysis.ts`)
gives static cross-section impact hints.

### D.2 The collaborate flow (route: `/project/[projectId]/collaborate`)

UI: `app/project/[projectId]/collaborate/collaborate-client.tsx` — 60/40 plan +
chat layout, proposals inbox, insights panel, auto-complete runner.

```text
AI suggests change
→ model emits <plan-update> block in chat (or proposals[] in analysis)
→ parseChatProposal / parseAnalysisResponse validates section id + value
→ buildProposal stamps currentValue FROM THE REAL SPEC (never the AI's claim)
→ proposal rendered for the user (never auto-applied)
→ user accepts  → PATCH /api/projects/[id] { sectionUpdate: { section, value, acceptedProposal: { id } } }
                   → validatePlanSectionValue → applySectionUpdate → spec re-parse
                   → decisionForProposal appended to project.planUpdateNotes (max 50)
                   → cached analysis proposals/findings for that section dropped
                   → audit event appended
→ user rejects  → PATCH { dismissProposalId } — removal persists
```

**Verdict:** the exact "AI suggests → user accepts → existing plan mutation"
loop the Co-founder needs **already exists and works**. Reuse
`buildCollaborateContext`, the proposal record type (`PlanProposal`), and the
PATCH `sectionUpdate` endpoint unchanged.

### D.3 Credit discipline (reusable)

`lib/analysis/collaborate-credits.ts`: charge-before-AI, refund-on-AI-failure
(`refundCollaboration`), zero-cost configs skip the ledger, costs
admin-configurable via `lib/billing/runtime-config.ts` (`DEFAULT_COLLABORATE_COSTS`).

### D.4 Versioning

There is **no plan version history** — edits overwrite the spec. The only undo
is auto-complete's section reset (`clearSectionUpdate`). Plan versioning is
missing infrastructure if the Co-founder wants reversible edits.

---

## E. Existing Application/Build Capabilities

Build pipeline: `buildInitialBuildPrompt(spec, understanding, preferences)`
(`lib/analysis/prompt-builder.ts`) → Totalum VCaaS
(`lib/integrations/totalum/service.ts` — launchProject, runAgent, stopAgent,
deployProject, getDevLogs/getProdLogs, versions/diff/recover, database CRUD,
secrets). Project states (`lib/types/project.ts`): created → analyzing →
analysis_complete → specification_ready → plan_ready → awaiting_build_confirmation
→ building → build_complete/failed → ready → deploying → deployed/failed.

| Question | Answer |
|---|---|
| What can be triggered programmatically? | Build, follow-up prompt, deploy, stop — all are plain authenticated POST APIs with reserve/refund credit discipline and atomic build-slot claims (`store.claimBuildSlot`) preventing concurrent runs. |
| What requires a frontend interaction? | Polling (`useProjectStatus`, `useProjectActivity` SWR hooks), build-summary display, secret entry (`buildSummary.secretKeysNeeded` → `POST /api/projects/[id]/secrets`-style flows), plan review before `plan_ready → build`. |
| What requires user confirmation? | Anything that spends credits: build (25k–75k by tier), follow-up edit (same), deploy (500), fork (15k–50k). UI uses `AlertDialog` confirmations (e.g. collaborate auto-complete dialog). |
| What requires a background job? | The build itself is async/fire-and-forget with state machine + event polling; `autoLaunchBuild` exists in `lib/analysis/pipeline.ts`. There is no durable job queue — progress is client-polled. |
| What requires external provider credentials? | `TOTALUM_API_KEY` (platform-wide, `isTotalumConfigured()`), `FIRECRAWL_API_KEY`, `OPENROUTER_API_KEY`; user-level GitHub OAuth token for push. |
| What should NEVER be directly exposed to an AI agent? | Secrets endpoints, runtime API key management, billing, deletion without confirmation, deploy without confirmation, direct database record mutations on generated apps. |

---

## F. Atai Runtime / SDK

**Platform infrastructure** (Co-founder's home):

- Session auth (`requireUser`/`requireAdmin`), credit ledger, projects store,
  respond envelope, rate limiting (`lib/auth/rate-limit.ts`, Mongo fixed-window),
  structured logging with secret redaction (`lib/logging/logger.ts`),
  `lib/env.ts` per-feature getters.

**Runtime infrastructure** (generated apps' power layer — `lib/runtime/*`,
`app/api/runtime/v1/*`, `packages/atai-sdk`):

- **Keys:** `lib/runtime/key-crypto.ts` (generate/hash/prefix), `lib/runtime/keys/*`
  (service, rotate, expiration, classification, provisioning). Secrets format
  `atai_<env>_<random>`, stored hashed, shown once.
- **Auth:** `authenticateRuntimeRequest()` (Bearer only) → trusted
  `{ userId, projectId, environment, scopes, requestId }`; scopes authorization
  in `lib/runtime/auth/authorize.ts`. `proxy.ts` exempts `/api/runtime/v1` from
  session-cookie gating (exact match documented for the v1/v10 pitfall).
- **Router:** capability/operation registry + 11 adapters (OpenRouter,
  ElevenLabs, Firecrawl, Resend, Twilio, Firebase, Mapbox, Cal.com, Cloudflare,
  Totalum, Dodo) via idempotent `registerAllRuntimeAdapters()`.
- **Metering:** admin-managed pricing rules (`fixed_per_request`,
  `per_1k_tokens`) in `app_settings`; fail-safe denial when unpriced;
  `runtime_usage` events + ledger debits with idempotent requestIds.
- **Limits/concurrency:** `enforceProjectRuntimeLimits`,
  `tryAcquireRuntimeSlot` (process-wide capacity, fail-fast 429), 256KB body cap.
- **Provisioning:** `lib/runtime/provisioning/service.ts` — idempotent
  `ensureRuntimeProvisioned(project, environment)` injects runtime credentials
  into the generated app at build/deploy time; `project.runtimeProvisioning`
  stores SAFE metadata only (status/keyId/prefix — never plaintext).
- **SDK:** `packages/atai-sdk` — `Atai` client, capability modules, normalized
  `AtaiError` surface; tests assert it never embeds provider credentials or
  endpoints.

**Boundary:** the Co-founder runs on **platform infrastructure with session
auth**. It must never mint or use `ATAI_API_KEY`s, never call
`/api/runtime/v1`, and never touch `api_keys`. If the Co-founder ever needs
provider power (e.g. web search for research), it should reuse the *adapter
pattern* server-side under its own authorization, not the runtime's
key-authenticated surface.

---

## G. Navigation System

### G.1 Route inventory (App Router)

| Route | Purpose | Dynamic params | Project context needed | Auth | Deep-link format |
|---|---|---|---|---|---|
| `/` | Landing | — | — | Public | — |
| `/login`, `/register`, `/forgot-password`, `/verify-email` | Auth | — | — | Public | — |
| `/dashboard` | Command center (next action, attention items, journey, activity, AI team cards) | — | active project derived client-side | Session | — |
| `/new` (+ `/new/idea`, `/new/website`, `/new/github`) | Project creation | — | — | Session | — |
| `/projects` | All businesses list | — | — | Session | — |
| `/workspace`, `/explore`, `/feature-requests`, `/referrals`, `/billing`, `/billing/top-up`, `/settings/*` | Workspace/explore/community/billing/settings | — | — | Session | — |
| `/project/[projectId]` | Project overview / build workspace | `projectId` | Yes | Session + ownership | `/project/{id}` |
| `/project/[projectId]/plan` | Plan editor | `projectId` | Yes | Session + ownership | `/project/{id}/plan` |
| `/project/[projectId]/collaborate` | **AI Co-Founder workspace** | `projectId` | Yes | Session + ownership | `/project/{id}/collaborate` |
| `/project/[projectId]/database` (+ `/[tableName]`) | Generated-app data browser | `projectId` | Built project | Session + ownership | `/project/{id}/database` |
| `/project/[projectId]/edit`, `/source`, `/tree`, `/repo-code`, `/readme`, `/env` | Source/code surfaces | `projectId` | Built project | Session + ownership | `/project/{id}/source` |
| `/project/[projectId]/runtime` (+ `/keys`, `/usage`, `/limits`, `/models`, `/health`, `/requests/[requestId]`) | Runtime control center | `projectId` | Built project | Session + ownership | `/project/{id}/runtime` |
| `/admin/*` | Admin (users, billing, ledger, runtime pricing, planning runs, feature requests) | various | — | `requireAdmin` | — |
| `/about`, `/pricing`, `/privacy`, `/terms`, `/docs`, `/modes-comparison`, etc. | Marketing/legal/public docs | — | — | Public | — |

### G.2 Navigation infrastructure

- **No centralized route constants, no navigation service, no typed route
  helpers, no deep-link utilities, no command palette (no cmdk).** Navigation is
  plain `next/link` `<Link href="...">` with template strings (e.g.
  `` `/project/${project.id}/collaborate` ``) — the strings above in
  `components/dashboard/command-center.tsx` and `components/app-header.tsx` are
  the de-facto registry.
- `useProjectActivity`/`interpretProjectState` (`lib/dashboard/view-model.ts`)
  already map activity events → `item.href` deep links (a mini precedent for
  "navigate me to the thing that happened").
- **Co-founder implication:** a small **route registry module + a `navigate`
  tool that returns a target for the client to `Link`/`router.push`** is new
  infrastructure that must be built; nothing unsafe exists to reuse, but
  nothing to conflict with either.

---

## H. Frontend Components

| Component | Location | Reusable? | Current consumers | Capabilities | Limitations | Recommended reuse |
|---|---|---|---|---|---|---|
| **CollaborateClient** | `app/project/[projectId]/collaborate/collaborate-client.tsx` | Partially | Collaborate page | Full chat + proposals + insights + auto-complete + confirm dialogs | Per-project only; inline page layout, not floating/global | Extract patterns (proposal cards, confirm dialogs); do not embed whole page |
| **ProjectActivity** | `components/project-activity.tsx` | Yes | Project workspace | Event timeline w/ level icons, stable data, user-facing filter | Project-scoped | Activity feed for Co-founder panel |
| **CreditMeter** | `components/credit-meter.tsx` | Yes | App header | Live balance, low-credit top-up nudge | Header-sized | Show agent credit spend context |
| **AlertDialog / Dialog** | `components/ui/alert-dialog.tsx`, `dialog.tsx` | Yes | Collaborate, billing, settings | Accessible modal + confirmation | — | **Confirmation UI for consequential actions** |
| **Sonner toaster** | `components/ui/sonner.tsx` | Yes | App-wide | Toasts | — | Action feedback |
| **DashboardCommandCenter** | `components/dashboard/command-center.tsx` | Partially | `/dashboard` | Attention items, journey, activity, "AI team" card, "Ask Atai" → collaborate | Static cards, not a chat | Replace/extend with Co-founder entry point |
| **AppHeader** | `components/app-header.tsx` | Yes | Layout | Global nav, credit meter, account menu | No global AI entry | Host the persistent Co-founder launcher |
| **ScrollArea, Tabs, Skeleton, Button, Input, Textarea, Badge, DropdownMenu** | `components/ui/*` | Yes | Everywhere | shadcn-style primitives (@base-ui/react) | — | Chat composer, panels |
| react-markdown | dep | Yes | Chat/markdown rendering | Markdown | — | Assistant replies |

**No existing floating panel, sheet/drawer, or command-palette component.** The
chat in Collaborate is the only conversation UI. A persistent/global Co-founder
panel is new UI, but all primitives it needs exist.

---

## I. Authentication & Authorization

### I.1 Existing protections (verified in code)

- **Sessions:** opaque random token in httpOnly `Atai_session` cookie;
  only SHA-256 hash stored (`sessions` collection, TTL 30d, per-device revoke).
  `getCurrentUser`/`requireUser`/`requireAdmin` in `lib/auth/session.ts` throw
  typed `AppError`s.
- **Edge gate:** `proxy.ts` (Next 16 replacement for middleware) rejects
  cookie-less `/api/*` with 401 before any DB hit; public prefixes listed
  explicitly (auth routes, webhook, `/api/internal/`, `/api/runtime/v1`).
  Shallow cookie-presence check only — never trusted as auth.
- **Ownership:** every project route re-reads the project and compares
  `project.userId === user.id` server-side (verified in: project GET/PATCH/
  DELETE, plan-chat, analyze-plan, auto-complete, build, agent, deploy, stop,
  github, activity, database/*, runtime/*). 404 is returned (not 403) to avoid
  leaking existence.
- **Credit system authorization:** balance checks + atomic Mongo-transaction
  ledger with idempotency keys; reservation model prevents double-spend.
- **Rate limiting:** per-action Mongo fixed-window (`checkRateLimit`) —
  build 5/hr, agent 20/hr, deploy 10/day.
- **Input validation:** zod everywhere at the boundary
  (`ApplicationSpecificationSchema`, `ProjectUnderstandingSchema`,
  `PlanAnalysisSchema`, section-value validator, 8KB chat-message cap).
- **Runtime plane isolation:** Bearer-key domain completely separate from
  session domain; key → user/project/environment derived server-side, never
  from client input.
- **Secrets hygiene:** logger redaction by key-name pattern; provider keys via
  `lib/env.ts`; GitHub token never leaves server; runtime provisioning stores
  metadata only.

### I.2 How Co-founder actions must inherit this

The AI is **never** the authorization layer. Every Co-founder tool executes by
calling the same server-side services the API routes use — i.e. each tool
implementation must: (1) run inside a session-authenticated request context,
(2) re-derive the user from the session (never from model output), (3) re-check
ownership against the store, (4) apply the same zod validation and allow-lists,
(5) charge credits through the existing ledger, (6) rate-limit per action. The
existing `requireUser → ownership check → validate → mutate → audit event`
pattern is the template; a tool that cannot satisfy it must not ship.

---

## J. Relevant APIs / Server Actions (reusable backend interfaces)

> Atai uses **API routes only** — there are **no `"use server"` server actions**
> in the codebase. All mutations are REST-style routes with the shared envelope.

| Name | Location | Method | Input | Output | AuthZ | Side effects | Co-founder reuse |
|---|---|---|---|---|---|---|---|
| list projects | `app/api/projects/route.ts` | GET | — | `ProjectSummary[]` | ownership-by-list | none | **READ tool** |
| create project | `app/api/projects/route.ts` | POST | `CreateProjectInput` | project | session | creates project, may fire analysis pipeline | tool w/ confirmation |
| get project | `app/api/projects/[id]/route.ts` | GET | — | full `Project` | ownership | none (singleFlight cache) | **READ tool (primary context source)** |
| update project / accept proposal | `app/api/projects/[id]/route.ts` | PATCH | `understanding?`, `specification?`, `sectionUpdate?`, `dismissProposalId?` | project | ownership + zod + section allow-list | spec change, decision note, event | **WRITE tool (plan edits)** |
| delete project | `app/api/projects/[id]/route.ts` | DELETE | — | `{deleted}` | ownership | permanent cascade | tool w/ hard confirmation |
| plan chat | `app/api/projects/[id]/plan-chat/route.ts` | POST | `{message ≤8000, activeSection?}` | `{reply, proposal?, decisions}` | ownership | credits (2), conversation append, event | **Core engine — reuse/extend** |
| analyze plan | `app/api/projects/[id]/analyze-plan/route.ts` | POST/GET | `{refresh?}` | `{analysis, cached}` | ownership | credits (10) when fresh, cache write | READ-ish tool |
| auto-complete | `app/api/projects/[id]/auto-complete/route.ts` | POST | section targeting | per-section drafts | ownership | credits per section, plan writes | pattern for multi-step runs |
| activity | `app/api/projects/[id]/activity/route.ts` | GET | — | last 100 events | ownership | none | **READ tool** |
| build | `app/api/projects/[id]/build/route.ts` | POST | `{specification?}` | `{buildRunId, totalumProjectId}` | ownership + rate limit | credit reserve/refund, Totalum launch, state machine | tool w/ confirmation |
| agent follow-up / stop | `app/api/projects/[id]/agent/*` | POST | `{prompt}` / — | run status | ownership + rate limit | credits, conversation, build slot | tool w/ confirmation (follow-up); stop = low-risk |
| deploy / deploy status | `app/api/projects/[id]/deploy/route.ts` | POST/GET | — | deploy status | ownership + rate limit | 500 credits, publish_events, runtime provisioning | tool w/ hard confirmation |
| github | `app/api/projects/[id]/github/route.ts` | GET/POST/DELETE | repo/branch | integration state | ownership + GitHub token | external writes to user's repo | confirmation; v2 |
| credits / credit-costs | `app/api/credits`, `app/api/credit-costs` | GET | — | balance / cost table | session | none | READ tools (budget awareness) |
| me / profile | `app/api/me/*` | GET/PATCH | profile fields | session info | session | avatar upload | READ tool (user context) |
| billing overview | `app/api/billing/overview` | GET | — | subscription/ledger | session | none | READ (careful surface) |
| runtime v1 | `app/api/runtime/v1/route.ts` | POST/GET | capability envelope | normalized response | **ATAI_API_KEY (not session)** | metered provider calls | **Do not reuse for Co-founder** |
| internal | `app/api/internal/*` | — | — | — | static shared secret | — | Do not extend; legacy pattern |

---

## K. Database / Data Model (MongoDB Atlas, db `Ataiai`)

Relevant collections and relationships (string-id references; no FKs):

```text
users ─┬─< projects (MirrorProject)            userId
       ├─< sessions                             userId
       ├─< credit_ledger (double-entry)         userId, referenceType/referenceId
       ├─< payment_records / subscription_records / topups
       ├─< referrals
       └─< api_keys (runtime)                   userId + projectId

projects ─┬─< build_runs                       mirrorProjectId
          ├─< project_assets                    mirrorProjectId
          ├─  project_github (integration doc)  projectId
          ├─  publish_events                    projectId
          └─  runtime_usage                     projectId
```

**`MirrorProject` — the Co-founder's context payload** (verified
`lib/types/project.ts`): `id, userId, mode (website|scratch|github), name,
state (14-value lifecycle), sourceUrl, crawlMode, pipelineMode, idea,
understanding (ProjectUnderstanding — pages, navigation, components,
designSystem, dataEntities, userFlows, screenshots, confidenceNotes…),
specification (ApplicationSpecification — the plan), totalumProjectId,
developmentUrl, events[] (audit trail), conversation[] (chat history),
deployment + deploymentHistory, buildSummary (post-build agent summary incl.
secretKeysNeeded), infrastructure subscription, preferences (appName, stack,
auth, db choice, notes), planAnalysis (cached findings/proposals),
planUpdateNotes (accepted decisions, max 50), githubReadme/githubFileTree/
githubZipUrl, visibility, runtimeProvisioning (safe metadata only).**

Other entities: `users` (credits, creditBuckets, referralCode, role, onboarding,
suspended/banned), `sessions`, `credit_ledger` (idempotencyKey unique,
balanceBefore/After, pricing/cost model versions), `build_runs` (status,
creditsReserved/Consumed, prompt, totalumUsage), `app_settings` (all
admin-configurable pricing), `planning_runs` (90d TTL), `firecrawl_cache` (7d),
`rate_limits`, `webhook_events`, `provider_usage`.

**No conversation/messages collection exists** — conversations are embedded
arrays on the project document. Workspace-level (cross-project) conversations
have **no home** today; that is new infrastructure (see §O).

---

## L. Existing Events / Activity

- **`project.events[]`** — append-only `ProjectEvent { id, at, level
  (info|warn|error), stage (analyze|understand|specify|plan|build|deploy|
  runtime), message }`. Written on: project creation, analysis milestones,
  credit charges, plan section updates, accepted decisions, build start/finish,
  deploy start/success/failure, co-founder chat sessions, runtime setup.
  Surfaced via `/api/projects/[id]/activity` + `ProjectActivity` +
  `filterMeaningfulActivity` (dashboard) + `isUserFacing` filter (hides
  internal API noise). **This is the workspace event stream a Co-founder can
  read to answer "what just happened?"**
- **`publish_events`** — deployment analytics (started/succeeded/failed,
  duration, productionUrl).
- **`runtime_usage`** — per-request provider telemetry for generated apps.
- **Admin audit logs** — `app/api/admin/audit-logs`, billing audit log, ledger
  (platform-level, not user-facing).
- **No realtime push** (no websockets/SSE to the dashboard; polling only), no
  notification center entity, no background job queue, no user-facing
  notification records. `dashboard-notifications` components are derived views
  of project state, not stored notifications.

---

## M. Capability Matrix

| Capability | Exists | Location | Reusable | AI-safe | Confirmation | Notes |
|---|---|---|---|---|---|---|
| List projects | ✅ | `app/api/projects/route.ts` GET | Yes | READ — auto | No | Lightweight summaries |
| Get project context | ✅ | `app/api/projects/[id]/route.ts` GET | Yes | READ — auto | No | Full MirrorProject incl. plan, conversation |
| Get project activity | ✅ | `app/api/projects/[id]/activity/route.ts` GET | Yes | READ — auto | No | Event stream |
| Get plan + health | ✅ | spec + `computePlanHealth` | Yes | READ — auto | No | Deterministic |
| Get credits balance | ✅ | `app/api/credits`, credit-service | Yes | READ — auto | No | Budget awareness |
| Analyze plan | ✅ | `analyze-plan/route.ts` | Yes | READ-ish | No (cached) | Charges credits when fresh |
| Co-founder chat | ✅ | `plan-chat/route.ts` | Yes | READ + proposal | No | Extension point for the new Co-founder |
| Update plan section | ✅ | PATCH `sectionUpdate` | Yes | LOW-RISK WRITE | Recommend confirm for multi-section batches | Allow-listed, validated |
| Dismiss proposal | ✅ | PATCH `dismissProposalId` | Yes | LOW-RISK WRITE | No | Persists rejection |
| Update project prefs/metadata | ✅ | PATCH (spec/understanding) | Yes | LOW-RISK WRITE | Confirm | Full-spec replace is broad — prefer sectionUpdate |
| Auto-complete plan | ✅ | `auto-complete/route.ts` | Yes | WRITE | **Yes** (existing dialog) | Multi-section credit spend |
| Create project | ✅ | `app/api/projects` POST | Yes | WRITE | **Yes** | May trigger paid pipeline |
| Build / follow-up edit | ✅ | `build`, `agent` routes | Yes | HIGH-RISK WRITE | **Yes — hard** | 25k–75k credits |
| Deploy | ✅ | `deploy/route.ts` | Yes | HIGH-RISK WRITE | **Yes — hard** | 500 credits, public URL |
| Delete project | ✅ | DELETE route | Yes | DESTRUCTIVE | **Yes — hard** | Permanent |
| Fork project | ✅ | `fork/route.ts` | Yes | HIGH-RISK WRITE | **Yes** | 15k–50k credits |
| GitHub push/connect | ✅ | `github/route.ts` | Adapt | EXTERNAL | **Yes** | Writes to user's repo |
| Custom domain add/remove | ✅ | `domain/route.ts` | Adapt | EXTERNAL | **Yes** | |
| Stop build agent | ✅ | `agent/stop` | Yes | LOW-RISK WRITE | No | |
| Read build logs/conversation | ✅ | `logs`, `agent/full-conversation` | Yes | READ — auto | No | |
| Navigation | ⚠️ Partial | `next/link` patterns only | Adapt | READ/客户端 | No | No route registry yet |
| Workspace-wide context (cross-project) | ⚠️ Partial | list + per-project reads | Adapt | READ — auto | No | No aggregated context endpoint |
| Cross-project search | ❌ | — | — | — | — | Missing |
| Streaming chat | ❌ | — | — | — | — | All AI calls are blocking |
| Tool/function calling | ❌ | — | — | — | — | Missing (core build item) |
| Workspace conversation persistence | ❌ | — | — | — | — | Only per-project embedded arrays |
| Plan version history | ❌ | — | — | — | — | Only auto-complete undo |
| Realtime events / push | ❌ | polling only | — | — | — | |
| Runtime API keys mgmt | ✅ | `lib/runtime/keys/*` | ✅ but | **NEVER** | — | Out of Co-founder scope |
| Secrets endpoints | ✅ | Totalum secrets | ✅ but | **NEVER** | — | Never expose |
| Billing mutations / webhooks | ✅ | `billing/*` | ✅ but | **NEVER** | — | Never expose |

---

## N. Proposed Co-founder Tool Registry

Grouped per the brief. Every tool names its real underlying implementation.
Risk levels: 🟢 auto-executable · 🟡 confirm · 🔴 never-direct.

### Workspace
```text
Tool: get_workspace_overview
Purpose: One snapshot — user identity, credits, active project, recent projects, attention items.
Existing implementation: GET /api/me + GET /api/projects + lib/dashboard/view-model logic
Input schema: {}
Output: { user, credits: {available, balance}, projects: ProjectSummary[], suggestedActiveProjectId }
Risk: 🟢 auto
Confirmation: no
Missing infra: an aggregation endpoint (or server-side composition inside the agent route) — no new DB models.
```

### Projects
```text
Tool: list_projects        → GET /api/projects. 🟢 auto.
Tool: get_project          → GET /api/projects/[id]. 🟢 auto. Input: { projectId }.
Tool: get_project_activity → GET /api/projects/[id]/activity. 🟢 auto.
Tool: create_project       → POST /api/projects. 🟡 confirm. Input: { mode, idea|sourceUrl, preferences? }.
Tool: update_project_preferences → PATCH /api/projects/[id]. 🟡 confirm.
Tool: delete_project       → DELETE /api/projects/[id]. 🔴 confirm-hard (typed "delete" confirmation).
```

### Plans
```text
Tool: get_plan             → project.specification + computePlanHealth. 🟢 auto.
Tool: propose_plan_update  → the existing proposal flow (chat <plan-update> / PlanProposal). 🟡 user must accept — proposals NEVER auto-apply.
Tool: apply_plan_update    → PATCH /api/projects/[id] { sectionUpdate }. 🟡 confirm. Only after explicit user acceptance of a proposal.
Tool: analyze_plan         → POST /api/projects/[id]/analyze-plan. 🟢 auto (cached; charges when fresh).
Tool: autocomplete_plan    → POST /api/projects/[id]/auto-complete. 🟡 confirm (existing dialog pattern).
```

### Applications / Build
```text
Tool: get_build_status     → GET /api/projects/[id] state + GET deploy status. 🟢 auto.
Tool: get_build_logs       → GET /api/projects/[id]/logs. 🟢 auto.
Tool: get_build_conversation → GET /api/projects/[id]/agent/full-conversation. 🟢 auto.
Tool: request_build        → POST /api/projects/[id]/build. 🔴 confirm-hard (25k–75k credits).
Tool: request_followup_edit → POST /api/projects/[id]/agent. 🔴 confirm-hard (tier-priced).
Tool: stop_build           → POST /api/projects/[id]/agent/stop. 🟢 auto.
Tool: request_deploy       → POST /api/projects/[id]/deploy. 🔴 confirm-hard (500 credits, public).
Tool: get_deployment_status → GET /api/projects/[id]/deploy. 🟢 auto.
```

### Navigation
```text
Tool: navigate
Purpose: Return a structured navigation target the client renders/executes (Link or router.push) — never a raw URL string from the model.
Existing implementation: NEW route-registry module built from the §G inventory (the only missing piece).
Input schema: { target: "dashboard" | "project" | "plan" | "collaborate" | "database" | "runtime" | "billing" | "explore" | ..., projectId?, params? }
Output: { href } — validated against the registry, never model-authored.
Risk: 🟢 auto (client-side only).
Confirmation: no
Missing infra: route constants module + client navigation handler.
```

### Search
```text
Tool: search_workspace — NOT CURRENTLY SUPPORTED.
No server-side project/conversation search exists (list is unfiltered). Future path:
Mongo text index over projects (name/idea/spec.title) or a dedicated search route. Do not fake it client-side.
```

### Account
```text
Tool: get_account_summary → GET /api/me (+ credits). 🟢 auto.
Tool: get_credit_costs    → GET /api/credit-costs. 🟢 auto (lets the Co-founder quote prices before asking for confirmation).
```

### Billing
```text
Tool: get_billing_overview → GET /api/billing/overview. 🟡 confirm (sensitive surface; read-only but private).
All billing MUTATIONS (checkout, top-up, subscription cancel): NOT CURRENTLY SUPPORTED as tools — must stay user-initiated UI.
```

### Runtime
```text
All runtime tools: NOT CURRENTLY SUPPORTED for the Co-founder.
Runtime keys, usage exports, model policy, limits are for generated applications and must stay outside Co-founder control. If the Co-founder should ever *describe* runtime usage, do it via READ of project.runtimeProvisioning metadata only.
```

---

## O. Missing Infrastructure (what must actually be built)

1. **Tool-calling agent loop.** No `tools:`/function-calling usage exists. Needed:
   a server-side agent endpoint that (a) defines the §N registry as AI SDK tool
   schemas, (b) executes tools **only** via the existing services with the
   `requireUser` + ownership pattern, (c) supports multi-step
   generate→tool→result→generate loops.
2. **Confirmation workflow.** A pending-action store + UI: tool marked
   "confirm" returns a structured `pending_action` (tool, params, cost,
   consequences) that the user approves in a Dialog; the approved action then
   executes server-side with a fresh ownership/credit check. Nothing like this
   exists (Collaborate's AlertDialog is UI-only precedent).
3. **Workspace-level conversation persistence.** Conversations are embedded
   per-project arrays only. A new `cofounder_conversations` collection (or user
   doc subdocument) with project-context references is needed for a persistent
   cross-page co-founder. Do not duplicate the plan-chat schema — reuse
   `ConversationMessage`.
4. **Route registry / navigation service.** Route constants + a `navigate`
   tool as specified in §N (currently scattered template strings).
5. **Workspace context aggregation.** An endpoint (or server composition) that
   assembles user + projects + active project + recent events for the system
   prompt, in the spirit of `buildCollaborateContext` but cross-project.
6. **Streaming (optional but recommended).** All AI calls block today. For a
   responsive co-founder, SSE/streaming UI is new work (`streamText` is
   available in the installed `ai` package but unused on the platform side).
7. **Search.** Server-side workspace search (text index) — §N marks it NOT
   CURRENTLY SUPPORTED.
8. **Plan versioning (optional).** For reversible co-founder edits beyond
   auto-complete undo.

---

## P. Risks

- **Authorization bypass via prompt injection:** project content (idea text,
  README, crawled content) flows into prompts. A malicious project/source could
  instruct the model to call tools. Mitigation: tools are executed server-side
  with session-derived identity and ownership checks — model output is never
  an authorization primitive; treat all model-requested params as untrusted
  input (zod-validate everything, as `validatePlanSectionValue` does today).
- **Hallucinated tool execution:** the model may claim an action happened.
  Mitigation: the Co-founder UI must render only *actual tool results*, never
  model prose about actions; mirror the existing "never pretend to have
  changed anything" rule in `COFOUNDER_CHAT_SYSTEM`.
- **Duplicate execution / race conditions:** double-clicked confirmations or
  retried tool calls could double-spend. Mitigations already in the codebase
  to reuse: ledger idempotency keys (unique index), atomic `claimBuildSlot`,
  `singleFlight` cache, Mongo transactions. Every mutating tool needs an
  idempotency key.
- **Destructive actions:** delete/build/deploy/fork spend or destroy
  irreversibly. Hard confirmations with explicit cost display; consider
  typed-confirmation for delete.
- **Credit exhaustion loops:** an agent loop that retries on
  INSUFFICIENT_CREDITS. Follow the existing discipline: charge → on AI failure
  refund; stop runs on 402 (auto-complete already pauses).
- **Cross-tenant leakage:** listing endpoints are ownership-filtered, but any
  new aggregation/search tool must filter by `userId` server-side from the
  first line — never accept a userId param.
- **Runtime/credential exposure:** `api_keys`, Totalum secrets, billing
  mutations must be unreachable from the tool registry (enforce by simply not
  defining those tools; registry is an allow-list, not a filter).
- **Context-window cost & leakage:** full `MirrorProject` is large; build a
  compact brief like `buildCollaborateContext` rather than shipping raw
  documents; never include secrets (none are stored on projects — verified).
- **Blocking AI calls in a long tool loop:** with no streaming and 4096-token
  caps, multi-tool turns can exceed request timeouts; design the agent route
  for bounded steps per turn.

---

## Q. Recommended Implementation Architecture

```text
User
 ↓
Co-founder UI (new persistent panel; reuses Dialog/AlertDialog, sonner,
               ProjectActivity, CreditMeter, react-markdown; hosted from AppHeader)
 ↓
POST /api/cofounder  (NEW session-authenticated route; requireUser + rate limit;
                      streaming-ready envelope consistent with lib/api/respond)
 ↓
Co-founder Agent (server, lib/cofounder/*)
   • system prompt: extension of COFOUNDER_CHAT_SYSTEM + workspace context brief
   • conversation history: new workspace conversation store (ConversationMessage reuse)
 ↓
Tool Registry (lib/cofounder/tools/* — the §N allow-list; each tool =
   { schema (zod), risk, requiresConfirmation, execute(ctx) })
 ↓
Authorization Layer (inside every execute(): requireUser-derived ctx.userId,
   ownership re-check via store.getProject, zod input validation,
   checkRateLimit, credit charge/refund via existing services)
 ↓
Existing Atai Services (store.ts, plan-sections, credit-service,
   collaborate-credits, totalum service, billing read APIs)
 ↓
MongoDB / Totalum / OpenRouter (unchanged)
```

Key decisions and why:

- **Where the agent lives:** server-side (`lib/cofounder/*` + a single
  `/api/cofounder` route), inside the Next.js app — same deployment shape as
  every other feature; no new service. The model layer is the existing
  `MODEL` export.
- **Tool definitions:** colocated with the agent (`lib/cofounder/tools/`) but
  each tool is a thin adapter over an existing service — no duplicated business
  logic. Registry is a closed allow-list.
- **Auth flow:** session cookie → `requireUser()` in the route → `ctx` passed
  to tools. Tools never accept userId/projectId ownership claims from the
  model without re-validating against the store.
- **Authorization flow:** identical to existing routes: derive → check →
  validate → mutate → audit (`store.appendEvent` for every tool execution,
  stage `"cofounder"`).
- **Tool execution:** two-phase for anything above 🟢: agent returns
  `pending_action` → client renders confirmation dialog (cost + consequences
  from `get_credit_costs`) → user approves → execution request carries the
  pending-action id → server re-validates and executes → result appended to
  conversation. This mirrors how proposals already work (suggest → accept →
  PATCH), just generalized.
- **Navigation:** `navigate` tool returns registry-validated hrefs; client
  performs navigation with `next/link`/router. Model never emits raw URLs.
- **Conversation persistence:** new workspace-level store reusing
  `ConversationMessage` shape, keyed by user, with per-project context tags.
  Existing per-project `project.conversation` stays untouched for Collaborate.
- **Errors:** every tool failure returns the standard
  `{ ok:false, error:{ code, message } }` envelope codes
  (INSUFFICIENT_CREDITS, UNAUTHORIZED_PROJECT_ACCESS, VALIDATION, AGENT_RUNNING,
  PROVIDER_NOT_CONFIGURED…) through `handleRouteError`; the agent translates
  them into co-founder-friendly replies and *never* retries spends silently.
- **Action logging:** every tool call writes a `ProjectEvent` (project-scoped)
  and an entry in the conversation record; charges are already visible in the
  credit ledger via existing `consumeCredits`.
- **Duplicate-execution prevention:** idempotency keys on every ledger write
  (existing), `claimBuildSlot` for build tools (existing), plus a
  pending-action single-use token so an approved action executes exactly once.

---

## R. Implementation Plan (future, not started)

**Phase 0 — Foundations (no AI):**
route registry module; `lib/cofounder` skeleton; decision record for the
conversation collection schema; pending-action schema.

**Phase 1 — Read-only co-founder:** `/api/cofounder` route + READ tools only
(get_workspace_overview, list/get project, activity, plan, credits) + workspace
conversation persistence + minimal floating panel UI. Ship value with zero new
risk surface.

**Phase 2 — Plan tools:** wire `propose/apply plan update`, `analyze`,
`autocomplete` through the tool registry with the two-phase confirmation;
reuse proposal persistence and PATCH `sectionUpdate` unchanged.

**Phase 3 — Confirmation engine:** pending-action store + approval UI +
single-use execution tokens + typed confirmation for delete.

**Phase 4 — Consequential actions:** `create_project`, `request_build`,
`request_followup_edit`, `request_deploy`, `stop_build` behind hard
confirmations with cost display; rate limits inherited.

**Phase 5 — Navigation & polish:** `navigate` tool + client handler; event
awareness ("what just happened") from `project.events`; credit-spend
transparency from the ledger.

**Phase 6 — Streaming & search (optional):** `streamText` migration for the
co-founder route; Mongo text-index workspace search (upgrades
`search_workspace` from NOT CURRENTLY SUPPORTED).

**Phase 7 — Hardening:** prompt-injection red-team, tool-loop caps,
cross-tenant tests, credit-abuse tests, audit review. Independent security
review before enabling any 🔴 tool by default.

---

# READY FOR IMPLEMENTATION

### Existing components we should reuse
- `CollaborateClient` patterns (proposal cards, confirm dialogs) —
  `app/project/[projectId]/collaborate/collaborate-client.tsx`
- `components/ui/*` primitives: `alert-dialog`, `dialog`, `sonner`,
  `scroll-area`, `tabs`, `button`, `input`, `textarea`, `skeleton`
- `components/project-activity.tsx` (event feed)
- `components/credit-meter.tsx` (budget transparency)
- `components/app-header.tsx` (host the persistent launcher)
- `react-markdown` for assistant replies

### Existing APIs/services we should reuse
- `lib/analysis/model.ts` (`MODEL`) + `generateText` (→ later `streamText`)
- `lib/analysis/cofounder.ts` — `buildCollaborateContext`, system prompts,
  proposal parsing/building (`PlanProposal`)
- `lib/analysis/plan-sections.ts` — section allow-list, validation,
  `applySectionUpdate`, `computePlanHealth`
- `app/api/projects/[id]/route.ts` PATCH `sectionUpdate` / `dismissProposalId`
- `app/api/projects/[id]/plan-chat`, `analyze-plan`, `auto-complete` (engine +
  credit pattern)
- `lib/billing/credit-service.ts` (grant/consume/reserve/release — idempotent)
  and `lib/analysis/collaborate-credits.ts` (charge/refund pattern)
- `lib/billing/runtime-config.ts` (admin-configurable costs — add a
  `cofounder` section the same way)
- `lib/store/store.ts` (`store.getProject/listProjects/appendMessage/
  appendEvent/claimBuildSlot`), `lib/api/respond.ts` envelope,
  `lib/auth/session.ts` guards, `lib/auth/rate-limit.ts`,
  `lib/cache/single-flight.ts`
- `lib/dashboard/view-model.ts` + `useProjectActivity` (`lib/client/api.ts`)
  for event→deep-link mapping
- `lib/runtime/provisioning` metadata (READ-only context about runtime state)

### New components we actually need
- Persistent Co-founder panel/launcher (floating or sidebar) with composer,
  streaming-ready message list, and pending-action confirmation dialogs
- Proposal/action cards generalized from the Collaborate proposal UI
- Route-registry-backed navigation handler (client)

### New backend infrastructure we actually need
- `/api/cofounder` agent route (session-auth, rate-limited, bounded tool loop)
- Tool registry (`lib/cofounder/tools/*`) as a closed allow-list over existing
  services
- Pending-action store + single-use execution tokens
- Workspace context aggregation (compact cross-project brief)
- Route constants/navigation service
- (Optional) streaming support; server-side workspace search

### New database structures we actually need
- `cofounder_conversations` (user-keyed; reuse `ConversationMessage` shape;
  project-context tags) — the only genuinely required new collection
- `cofounder_pending_actions` (or subdocument) — tool, params snapshot, cost,
  status, single-use token, expiry
- Optional later: Mongo text index for workspace search; plan version history

### New agent/tool infrastructure we actually need
- Tool schemas (zod) + risk classification + confirmation flags (§N)
- Two-phase execute (propose → approve → execute-once)
- Tool-result rendering contract (UI shows real results, never model claims)
- Per-tool rate limits and per-turn step caps; INSUFFICIENT_CREDITS stops loops
- Audit: `ProjectEvent` stage `"cofounder"` per execution

### Things we absolutely must NOT duplicate
- A second AI provider layer (use `lib/analysis/model.ts`)
- A second credit/billing system (use `credit-service` + ledger)
- A second proposal/plan-mutation path (use PATCH `sectionUpdate` +
  `plan-sections.ts`)
- A second project store or context builder (reuse `store` +
  `buildCollaborateContext` patterns)
- A second event/activity system (reuse `ProjectEvent` + activity routes)
- The Runtime API/SDK plane (`/api/runtime/v1`, `packages/atai-sdk`,
  `api_keys`) — different auth domain, different customers
- `/api/internal/*` static-key auth pattern (legacy; do not extend)
- Conversation schemas (reuse `ConversationMessage`)

### Things that require explicit confirmation
- `create_project` (may trigger paid pipelines)
- `update_project` full-spec/understanding replacement (prefer sectionUpdate)
- `autocomplete_plan` (multi-section credit spend — existing dialog pattern)
- `request_build` / `request_followup_edit` (25k–75k credits)
- `request_deploy` (500 credits, public URL)
- `delete_project` (permanent — typed confirmation)
- `fork_project` (15k–50k credits)
- GitHub connect/push, custom domain add/remove (external side effects)
- Batch plan updates (more than one section per turn)

### Things that should remain outside Co-founder control
- Runtime API key lifecycle (`lib/runtime/keys/*`, `api_keys`) and
  `/api/runtime/v1` invocation
- Totalum secrets create/delete; any credential surfaces
- Billing mutations: checkout, top-ups, subscription changes, webhook handling
- Direct database record mutations on generated apps (`database/*` write
  routes) in v1
- User administration (`/api/admin/*`), self-credits, ledger reconciliation
- Email verification, password/session management
- The planning pipeline internals (`lib/planning/*`) and build prompts

---

*End of audit. This report is the source of truth for the separate
implementation prompt. No code was modified during this audit.*
