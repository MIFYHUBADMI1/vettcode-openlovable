# Atai — Application Intelligence & Monitoring: Phase 0 Codebase Audit

- **Audit date:** 2026-10-25
- **Package:** `atai` v5.0.0, branch `main` (shallow clone)
- **Method:** Read-only static inspection of source, tests, docs, and manifests, focused on capabilities relevant to Application Intelligence & Monitoring. Cross-checked against `docs/audits/atai-marketing-monetization-audit.md` (2026-10-09), whose verified architecture map this audit re-confirms at the seams it depends on. Claims reused from that audit are labeled *via prior audit*; everything else below was re-verified directly in this session. **No application code, schema, dependencies, credentials, or configuration were modified. No live database, deployment, or external system was exercised.**
- Status vocabulary: **VERIFIED WORKING / PARTIALLY IMPLEMENTED / UI ONLY / NOT IMPLEMENTED / INTEGRATION BOUNDARY / UNVERIFIED.**

---

## Section 1 — Executive summary

**What this project is.** A dedicated Application Intelligence & Monitoring capability: founders of Atai-generated applications should be able to see what happens inside their app (usage, journeys, retention), whether the app is healthy (errors, performance), hear their customers (feedback), get evidence-grounded AI recommendations, route those into Atai's existing engineering workflows, and verify with before/after measurement that implemented changes worked.

**What Atai already has that this project can reuse (all VERIFIED WORKING at the seams used):**

1. **Project workspace + ownership gates** — `app/project/[projectId]/*` pages behind `requireOwnedProject`; APIs behind `lib/runtime/ownership.ts` `checkProjectOwnership`; uniform 404 for non-owners. The workspace sidebar (`components/workspace/atai-nav.ts`) is the single navigation registry; Marketing & Monetization occupies its own reserved group (`workspaceGrowNav`) and remains untouched.
2. **Runtime capability gateway** — `app/api/runtime/v1/route.ts` → `lib/runtime/router/router.ts`; 11 provider adapters; Bearer-key authentication whose trusted context (`apiKeyId`, `userId`, `projectId`, `environment`, `scopes`) is derived **exclusively from the key record** and never from request input (`runtime/contracts/auth.ts`, security invariant enforced by tests). This is the correct trusted-identity foundation for application-event ingestion.
3. **Metering as a real reliability signal** — `runtime_usage` records per request: `capability`, `operation`, `provider`, `status: succeeded|failed`, `latencyMs`, `creditsCharged`, `createdAt`, keyed by `projectId`/`environment` (runtime/contracts/capabilities.ts `RuntimeUsageEventSchema`; `lib/db/runtime-collections.ts`). Failed-request rates and latency percentiles for **runtime-mediated** operations are *already real data*.
4. **Generated-app logs** — `app/api/projects/[id]/logs/route.ts` retrieves Totalum dev/prod logs on demand (ownership-gated, provider-gated). Real, but read-through only: nothing is parsed, persisted, or alert-deflected today.
5. **AI co-founder + approval framework** — `lib/cofounder/agent.ts`, tool registry (closed allow-list, 4-tier risk ladder `READ→HARD_CONFIRM`), atomic single-use pending actions, and the navigation-target registry `lib/navigation/routes.ts` (the AI never authors an href). This is the vehicle for evidence-grounded recommendations and improvement workflows — not a new agent.
6. **Metric-trust convention** — Marketing Phase 2 established typed availability states (`available / measured_zero / unavailable / not_instrumented`) enforced in view models so UI cannot render an unmeasured metric as a number (`lib/marketing/growth-overview.ts`, `docs/implementation/atai-marketing-monetization-phase-2.md§3`). This project adopts and generalizes that policy; **a large part of the master prompt's honesty requirements is already partially encoded in repo convention**.
7. **Feature-request system** — `lib/feature-requests/**`, 5 collections. It is **platform-level** (Atai's own users voting on Atai features). It is not per-generated-app customer feedback; it is reusable as a *pattern* (status history, votes, updates, internal notes), not as a data source for app-customer feedback.
8. **Structured, redacting logging** — `lib/logging/logger.ts` strips secret-shaped values; `instrumentation.ts` has an `onRequestError` hook (platform-realm).

**What does not exist (NOT IMPLEMENTED, verified absent):**

- **Any application-event ingestion** — no endpoint, no SDK namespace, no collection, no event schema. Generated apps report nothing back to Atai. (Also concluded by the prior audit: "no ingestion endpoint, no analytics collection, no SDK telemetry — by design".)
- No analytics/journeys/retention UI or computation.
- No error-group storage, exception ingestion, or performance samples beyond `runtime_usage.latencyMs`.
- No experiments, baselines, or impact-measurement records.
- No alerting/notification pipeline beyond transactional email (`lib/email/mailer.ts`).

**Hard constraints that shape the design:**

1. **No background-job substrate.** No queue, worker, cron, or scheduler exists; prior phases deliberately refused to fake durability. Event ingestion is a synchronous validated write (cheap, safe without a queue). Heavy aggregation must be computed at read time over bounded windows; precomputation requires the job-substrate decision already documented in phase-2 report §5.
2. **Generated apps are built on Totalum** (external platform; its code generation is out of this repo). Generated apps integrate `@atai-group/sdk` server-side with a private runtime key. A *browser-public* ingestion credential does not exist and must not be improvised by reusing private keys in frontend code.
3. **`runtime_usage` has no retention policy** (documented deliberately in `lib/db/runtime-collections.ts`); any new event collection must decide retention explicitly, not by accident.
4. Windows: existing usage summaries cap at 90 days (phase-2 report §2).

**Recommended architecture (summary):** add an `analytics` capability to the existing Runtime contract (SDK → `/api/runtime/v1` → validated ingest), so event identity comes from the already-proven key-derived runtime context; store raw events in a new project-scoped collection with explicit retention; compute analytics on read with bounded windows under the metric-trust convention; surface through a new **Intelligence** nav group in the project workspace; ground AI recommendations in the cofounder tool registry as READ tools; route improvement actions through the existing pending-action approval pattern; measure impact with explicitly-recorded baselines. Phase-by-phase plan in Section 8.

---

## Section 2 — Architecture map (verified)

| Layer | Reality (evidence) |
|---|---|
| Frontend | Next.js 16.3.3 App Router, React 19, Tailwind v4 + shadcn (`components.json`), Zustand, SWR |
| Backend | ~126 route handlers under `app/api/**`; shared envelope `lib/api/respond.ts`; edge gate `proxy.ts` (Next 16 middleware replacement, `proxy.test.ts`) |
| Database | MongoDB 7.6 raw driver; lazy singleton `lib/db/mongodb.ts`; 33 typed accessors (`lib/db/collections.ts`, `lib/db/runtime-collections.ts`); idempotent `ensureIndexes()` at first access; **no migrations tool** |
| Auth | Opaque DB-backed session cookies (`lib/auth/session.ts`), bcrypt, OAuth; `requireUser`/`requireAdmin`; Mongo fixed-window rate limiting (`lib/auth/rate-limit.ts`) |
| Tenancy | `MirrorProject.userId` ownership (`lib/types/project.ts`); fail-closed `checkProjectOwnership`; co-founder `ownedProject(ctx, projectId)` |
| AI | Vercel AI SDK v7 via OpenRouter co-founder (6-step tool loop), planning orchestrator, plan analysis |
| Runtime | SDK `packages/atai-sdk` (zero-dep ESM, 14 capability namespaces incl. `HealthCapability`); single RPC `POST /api/runtime/v1`; contracts in `runtime/contracts/**` (Zod; SDK-consumable, server-import-free) |
| Billing | Dodo Payments; credit ledger with idempotency; `runtime_usage` metering (status/latency per request) |
| Hosting | Totalum build/deploy/domains/**logs/secrets**; `deploymentHistory[]` + `totalumProjectId` on the project |
| Testing | Vitest 5, node env; `pnpm test`; tests concentrated in `lib/runtime`, `lib/billing`, `lib/planning`, `packages/atai-sdk`, plus route-level tests (e.g. `app/api/runtime/v1/route.test.ts`) |

**Directories confirmed:** `app` (pages+api), `components`, `lib` (28 domains incl. `runtime`, `cofounder`, `feature-requests`, `marketing`, `navigation`, `logging`, `infrastructure`), `packages/atai-sdk`, `runtime/contracts`, `docs/{audits,implementation}`, `scripts`, config at root.

---

## Section 3 — Telemetry category boundaries (master prompt §0.3)

These four categories are kept distinct in type, collection, and UI labeling:

| Category | Existing source today | Owner | Notes |
|---|---|---|---|
| **Atai platform telemetry** | `@vercel/analytics` (site-only, `app/layout.tsx`), `planning_runs`, `credit_ledger`, `webhook_events`, sessions | Atai platform | Not project-scope; never mixed into app analytics |
| **Generated-application telemetry** | **None** — to be created in Phase 2 | Atai platform, project-scoped | `analytics` capability via Runtime; raw events in a new collection |
| **Business data** | Generated app's own database (its `db` capability / Totalum DB) — **owned by the app**; platform sees only metadata | Generated app | Analytics must never read app business records wholesale; aggregates only via event properties the app chooses to send |
| **Operational telemetry** | `runtime_usage` (failed/latency for runtime calls), Totalum prod logs (read-through), platform `onRequestError` | Mixed — attribution rules defined per metric | `runtime_usage` failed/latency is *platform-API* health of the app's runtime calls, not the app's own endpoints' health. Totalum logs are the app's server logs. Both labeled honestly in UI |

---

## Section 4 — Capability inventory

| # | Capability (prompt) | Status | Evidence / notes |
|---|---|---|---|
| 1 | Secure event ingestion | **NOT IMPLEMENTED** | No `analytics`/`track` anywhere in `lib`, `packages/atai-sdk/src`, `runtime/contracts` (grep). No related route under `app/api`. |
| 2 | Event schema + validation | **NOT IMPLEMENTED** | Contracts exist only for the 20 runtime capabilities (`runtime/contracts/capabilities.ts`); Zod conventions ready to copy. |
| 3 | Credentialed identity for ingestion | **VERIFIED WORKING (reuse)** | Key-derived `RuntimeAuthContext`; scopes prefix-tolerant; one-time create/rotate/revoke lifecycle; environments dev/prod. No public/browser key tier. |
| 4 | Rate limiting / quotas | **PARTIALLY IMPLEMENTED** | `lib/auth/rate-limit.ts` (session routes) + runtime concurrency/limits (`lib/runtime/concurrency.ts`, `platform-limits.ts`) — extension point, do not invent a parallel limiter. |
| 5 | Application analytics (metrics/dashboards) | **NOT IMPLEMENTED** for app events; **PARTIAL** for runtime-mediated usage (`lib/runtime/usage.ts` accessors; marketing growth overview consumes them). UI template: `components/runtime-control/*` (usage tables, filters, pagination, export, health). |
| 6 | Journeys, funnels | **NOT IMPLEMENTED** | No funnel/journey code or collections. Requires ingestion first. |
| 7 | Retention / cohorts / churn | **NOT IMPLEMENTED** | No cohort machinery. Subscription churn is only honest after billing/event data lands per-app. |
| 8 | Error monitoring | **PARTIALLY IMPLEMENTED / INTEGRATION BOUNDARY** | Runtime-mediated failures + latency exist in `runtime_usage`; Totalum prod logs reachable per project (no persistence/parsing/issue groups); generated-app client exceptions unreachable today → new **exception ingestion** must ride the same event pipeline. No Sentry/PostHog (grep: *via prior audit*, re-grepped). |
| 9 | Performance monitoring | **PARTIALLY IMPLEMENTED** | `latencyMs` per runtime request (p50/p95/p99 computable on read); no app-endpoint/web-vitals instrumentation. |
| 10 | Customer feedback (per-app) | **NOT IMPLEMENTED** | `feature_requests` is platform-level. Per-app feedback = new event-backed ingestion or honest `not_instrumented`. Reuse vote/status-history patterns only. |
| 11 | Feature flags / experiments | **NOT IMPLEMENTED** at app level. Platform-realm env-based flags exist (`lib/marketing/feature-flags.ts`) — a different thing; not a per-app experiment system. |
| 12 | AI diagnosis / recommendations | **NOT IMPLEMENTED**; vehicle verified: cofounder tool registry (closed list, risk ladder), `pending-actions` approvals, navigation targets. |
| 13 | Engineering workflow integration | **VERIFIED WORKING (reuse)** | Existing build/plan/deploy/agent flow + pending actions; no parallel pipeline allowed. |
| 14 | Impact measurement / baselines | **NOT IMPLEMENTED** | No before/after records anywhere. |
| 15 | Settings / instrumentation config | **NOT IMPLEMENTED** for analytics; project settings route exists (`app/api/projects/[id]/settings`) as convention. |
| 16 | Admin platform monitoring | **PARTIALLY IMPLEMENTED** | `app/admin/**`, `lib/infrastructure/audit.ts`; extend — no duplicate admin app. |
| 17 | Notifications/alerts | **NOT IMPLEMENTED** beyond transactional email; honest boundary required. |
| 18 | Privacy/consent controls | **NOT IMPLEMENTED** for app events; redaction logger (`lib/logging/logger.ts`) + generated-app privacy boundary conventions to extend. |

**Investigation of third-party options:** no PostHog/Sentry/other analytics provider is present or configured. Given the key-derived identity, per-project model, and zero-dependency SDK, a first-party minimal pipeline is the lower-risk path; external vendors are deferred unless a concrete requirement emerges (recorded as a decision in the phase report that adds them, if ever).

---

## Section 5 — Data flow (target: generated app → insight)

```
Generated app (Totalum-hosted)
  ├─ app-server:  @atai-group/sdk  →  POST /api/runtime/v1  (Bearer runtime key)
  │     op: analytics.track / analytics.identify / analytics.page
  │     → key-derived RuntimeAuthContext (projectId/environment/scopes)
  │     → zod event validation, size/property limits, rate limit, dedup by event id
  │     → app_events collection (raw, project-scoped, explicit retention)
  └─ app-client (browser): NOT in initial scope (no public credential exists);
        documented pattern: app client → app's own server (compiles to server-side
        track) or a future dedicated public ingestion key tier — a deliberate,
        separately-approved credential design change, never private keys in the browser.

  Atai founder workspace (session auth, requireOwnedProject)
     GET project intelligence APIs  → bounded-window reads over app_events +
     runtime_usage + error groups → view model with metric-trust availability states

  AI co-founder (tools, READ-tier, project-tenant-checked)
     reads intelligence aggregates → evidence-grounded recommendations
     → cofounder pending-actions approval → existing build/plan/engineering flow
     → post-change measurement against recorded baselines
```

**Identity rules carried from the security invariant:** `userId`/`projectId`/`environment`/`scopes` are never accepted from client-supplied bodies/headers/query strings; SDK events carry only app-chosen properties + pseudonymous ids; the platform decides nothing about user identity from the wire.

---

## Section 6 — Reuse list (no duplication allowed)

- Authn/session, ownership gates, respond envelope, rate limiting, proxy tests.
- Runtime key lifecycle + `RuntimeAuthContext` + contracts pattern (Zod, SDK-consumable).
- `runtime_usage` accessors (`lib/runtime/usage.ts`) for health/latency analytics.
- Cofounder tool registry, risk ladder, pending actions, navigation registry (`ProjectTarget` union).
- Metric-trust availability types/stats helpers (generalize from `lib/marketing/growth-overview.ts`).
- `components/runtime-control/*` as the data-heavy dashboard UI template.
- Totalum logs route + service for read-through app logs.
- `lib/logging/logger.ts` server-side logging; `lib/infrastructure/audit.ts` for admin-sensitive actions.
- Feature-request *patterns* (status history, votes) if per-app feedback is built later.

---

## Section 7 — Risks, blockers, and decisions to carry forward

1. **Browser telemetry has no credential tier.** Initial scope = server-side (SDK in generated app's server code), which covers most meaningful events in Totalum apps. Client-side `atai.analytics` wafer is *deferred* with an explicit INTEGRATION BOUNDARY note until a public ingestion key design is approved. No fake claims that client auto-instrumentation exists.
2. **No job substrate** → aggregation on read with bounded windows + documented freshness; recommendation generation triggered by explicit founder action or cofounder conversation, never a pretend async worker.
3. **Retention must be explicit.** New `app_events`/error-group collections get a documented retention plan; no TTL auto-delete without an approval (mirrors `runtime-collections.ts` precedent) — deletion is opt-in per project (privacy requirement), executed via explicit admin/owner action.
4. **Prompt-injection discipline.** Event properties and feedback text are untrusted input to AI tools — never executed, only displayed/summarized; cofounder read tools must sanitize and bound payloads (pattern already exists in growth tool).
5. **Windows build environment:** prior phase reported `pnpm build` failing with a Windows-specific Turbopack spawn error (documented environmental). Type-check (`tsc --noEmit`) + vitest remains the local verification gate; CI workflow `.github/workflows/ci.yml` exists (from marketing phase 2) — UNVERIFIED whether it has ever run remotely.
6. **Marketing & Monetization isolation:** new nav group and routes are additive; no marketing route/model/service is touched.

---

## Section 8 — Phased implementation plan (dependency order)

| Phase | Scope | Key files (expected) |
|---|---|---|
| 1 | IA: `intelligence` nav group (project workspace only), route registry targets, shared metric-trust module, honest landing overview built from existing data | `components/workspace/atai-nav.ts`, `lib/navigation/routes.ts`, `lib/intelligence/*`, `app/project/[id]/intelligence/*` |
| 2 | **Ingestion core:** `analytics` capability contracts (track/page/identify/alias w/ session + identity rules), server validation/limits/dedup/quota, `app_events` collection + indexes + retention design, SDK `AnalyticsCapability`, project analytics settings (enable/disable, event allow-list, pseudonymization), pipeline write tests | `runtime/contracts/analytics.ts`, `lib/runtime/router/**`, `lib/intelligence/ingest/**`, `lib/db/*-collections.ts`, `packages/atai-sdk/src/**`, `app/project/[id]/intelligence/settings` |
| 3 | Application analytics: definitions/counting rules, overview + feature adoption + data-quality view models + API + UI, period comparison, drill-downs | `lib/intelligence/metrics/**`, intelligence routes/pages, `components/intelligence/*` |
| 4 | Journeys & funnels: funnel definitions (ordered events, windows, user identity), conversion math + tests, funnel builder UI, diagnosis drill-downs | `lib/intelligence/funnels/**` + UI |
| 5 | Retention & churn: cohort tables, first-use cohorts, returning-user definitions, inactivity/churn-risk rules (activity-based only), honest subscriptions boundary | `lib/intelligence/retention/**` + UI |
| 6 | Health & observability: error ingestion (app-reported exceptions via pipeline), error grouping, release/deploy association, latency percentiles from `runtime_usage`, Totalum prod-log read-through, health overview; monitoring-configured-vs-silent distinction | `lib/intelligence/health/**`, `lib/db` error groups |
| 7 | Customer insights + per-app feedback ingestion paths (event-backed), insight discovery with evidence refs, separation of measured/feedback/AI-hypothesis | `lib/intelligence/insights/**` |
| 8 | AI intelligence: cofounder READ tools over intelligence aggregates (tenant-checked, bounded, sanitized), recommendation generation + prioritization + lifecycle (`recommendations` collection), "Ask about this app" via cofounder conversation | `lib/cofounder/tools/intelligence.ts`, `lib/intelligence/recommendations/**` |
| 9 | Improvement workflows: recommendation → pending-action approval → existing plan/build execution → status honesty (generated ≠ fixed) | wiring into `lib/cofounder/pending-actions.ts`, existing project actions |
| 10 | Experiments & impact: baselines, before/after comparisons (pp vs %), lifecycle statuses, inconclusive-by-design | `lib/intelligence/impact/**` |
| 11 | Settings & admin: ingestion health/quotas/schema errors, admin project instrumentation status — integrated in existing admin | `app/admin/**`, `app/api/billing`-style guarded routes |
| 12 | Data governance: retention execution path, deletion workflows, doc'd freshness indicators | `lib/intelligence/retention-jobs` (behave-as-while-you-wait unless substrate exists) |
| 13 | Tests: unit (validation, metrics, funnels, cohorts, grouping, prioritization, impact), integration (ingestion auth/tenancy, persistence, aggregation), route-level, regression suites | alongside each phase + dedicated |
| 14 | Documentation + final report (this format) | `docs/audits/…phase-N…`, `docs/implementation/atai-application-intelligence-phase-N.md` |

**Vertical-slice rule:** Phase 2 must deliver ingestion *through to a rendered count* in the Intelligence Overview before Phase 3 expands breadth.

**Out of scope (standing):** Marketing & Monetization routes/models/nav; generated-app code generation; new payment/identity providers; browser-public credentials (deferred, deliberate); NoSQL schema-breaking refactor; deleting production data.

---

## Section 9 — Test strategy

1. **Unit:** event validation (names/sizes/types/limits), session-identity rules, dedup, metric counting rules, funnel math (window/repeat/order), cohort boundaries, error grouping, recommendation prioritization + dedup, pp-vs-% change, availability-state policy.
2. **Integration:** ingestion end-to-end (key→contract→store), tenant isolation (cross-project reads fail), rate limits, retention/deletion ops, aggregation queries, cofounder tool authorization.
3. **Route-level + fixture:** vitest route tests mirroring `app/api/runtime/v1/route.test.ts`; fixture test exercising instrumenting → ingesting → dashboard query → funnel → recommendation Init.
4. **Security:** cross-tenant access, forged identity fields stripped (tests already enforce the auth invariant), oversized payloads, rate limits, secret-shape redaction in events, telemetry-as-instructions refusal (AI tools treat properties as data).
5. **Regression:** existing suites must stay green; any pre-existing failure documented, never hidden.

---

## Phase 0 checkpoint

Per the master directive, this audit is now the archived checkpoint. Findings: the platform already provides identity, transport, metering, AI-approval, and UI rails; ingestion + analysis are the greenfield core. Implementation proceeds into Phase 1 (product architecture/IA) then Phase 2 (ingestion core) — continuing immediately, with honest INTEGRATION BOUNDARY for browser telemetry and job-dependent execution claims as required.
