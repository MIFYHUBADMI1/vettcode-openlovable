# Atai Marketing & Monetization — Phase 2 implementation report

**Phase:** Secure Foundations, Project Growth Workspace & Growth Overview
**Date:** 2026-10-09
**Branch:** `main` (changes left uncommitted for review — nothing was committed, pushed, or deployed)
**Predecessor:** `docs/audits/atai-marketing-monetization-audit.md` (Phase 1)

---

## 1. What was implemented (production code, not a plan)

| Area | Deliverable | Files |
|---|---|---|
| A1 Feature-flag strategy | Env-only flags extending the verified `USE_ENHANCED_PIPELINE` convention; server-side only; deterministic percent rollout; kill switch restores the EXACT previous coming-soon behavior | `lib/marketing/feature-flags.ts` (+ test) |
| A2 Verification workflow | Minimal GitHub Actions CI matching repo reality (no lint config exists → type check + Vitest + `next build`); GitHub remote confirmed present (`vettcode-openlovable`) | `.github/workflows/ci.yml` |
| A3 Integration/isolation | Zero new credential or auth code. Ownership reuses `requireOwnedProject` (page, uniform `notFound`) and the co-founder `ownedProject()` session-derived gate (tool, uniform `UNAUTHORIZED_PROJECT_ACCESS`). No client `userId` is ever trusted | `app/project/[projectId]/market/page.tsx`, `lib/cofounder/tools/growth.ts` |
| A4 Background-work decision | Documented (section 5 below): **no job platform was built**, nothing in this phase needs one, and no fire-and-forget promise is presented as a durable job | this report |
| A5 Metric-trust policy | Typed availability states enforced in the view model itself; the UI cannot render an unmeasured metric as a number | `lib/marketing/growth-overview.ts` (+ test), `components/marketing/growth-overview-view.tsx` |
| Growth Overview page | `/project/[projectId]/market` activated: project state, what Atai knows, AI-drafted plans (labeled not-executed), genuine measurements with availability badges, deterministic next steps, fixed trust notes | page + view + `components/workspace/atai-nav.ts` (nav `soon → link` for Market only) |
| §6 Co-founder tool | Read-only `get_growth_overview` registered in the closed registry, risk `READ`, no confirmation, flag-aware, tenant-checked, bounded payload, structured `navigation: { target: "market" }` — never mutates, publishes, or spends | `lib/cofounder/tools/growth.ts` (+ test), `tool-registry.ts`, `schemas.ts`, `types.ts` (`growth_overview` result type), registry tests updated (intentional allow-list expansion, documented) |
| §69 Navigation registry | New project target `market` → `/project/[id]/market` (the AI still never authors an href) | `lib/navigation/routes.ts` (+ test) |

No new collections, no schema/migration changes, no new dependencies, no new secrets, no credit charges for viewing, no external provider calls, no widened runtime key scopes.

## 2. The Growth Overview view model

`getGrowthOverview({ user, project })` (server-only) assembles `GrowthOverview` exclusively from already-collected data:

- **Project record** — lifecycle state, deployment status/URL, stored `specification` (plan sections + AI plan text), owner onboarding goals (page only; the tool's `ToolContext.user` carries no onboarding shape).
- **`runtime_usage`** — `summarizeProjectUsage` over a 30-day window (well under the 90-day cap) for runtime API requests; a direct bounded `countDocuments` with `capability: /^payments/` for checkout calls.
- **`credit_ledger`** — `referenceType: "project", referenceId: projectId` sums `debits − reversals` (credits are never charged for reading this page).
- **`referrals`** — `countDocuments({ referrerUserId })`, explicitly labeled owner-account-level.
- **`computePlanHealth`** — deterministic plan-completeness and missing-section derivation (existing helper, re-executed, never stored a second time).

## 3. Metric-trust table (A5 / spec section 6)

Availability states: `available` / `measured_zero` / `unavailable` (read failed; value `null`, reason shown) / `not_instrumented` (platform has no data source). A measured zero and an unavailable measurement are distinct states in the type and in the UI badges ("measured · zero" vs "data unavailable" vs "not measured yet"). **No row of zeroes is ever rendered for a missing source.**

| Metric | State policy | Distinction enforced |
|---|---|---|
| Runtime requests (30d) | measured (real zero possible) | ≠ website visitors / page views |
| Checkout (payments-capability) calls | measured (real zero possible) | creation ≠ **completed payment** |
| Credits consumed by project | measured from ledger | credit consumption ≠ revenue |
| Completed payments | always `not_instrumented` | Atai cannot see settlement inside generated apps |
| Site visitors | always `not_instrumented` | no analytics ingestion exists; never fabricated |
| App revenue | always `not_instrumented` | Atai platform revenue ≠ generated-app revenue |
| Conversion rate | always `not_instrumented` | needs visitor + outcome data; never estimated |
| Owner account referrals | measured | owner-level ≠ project-level referrals |
| Project-level referrals | always `not_instrumented` | referral model has no project attribution |
| Deployment | state-only badge + caveat | deployment success ≠ customer acquisition |
| AI plan documents | `origin: "ai_generated_planning_context"`, `executed: false` | AI plan text ≠ executed activity |

## 4. Security posture actually applied

- Page auth: unchanged `requireOwnedProject` → non-owners get the uniform 404; the route never queries by a client-supplied user.
- Tool auth: `ownedProject(ctx, projectId)` compares `project.userId !== ctx.user.id` with the session-built `ToolContext`; forged `userId` inputs are stripped by the `.strip()` zod schema and never read (asserted in tests).
- Flag evaluation is server-side only; no `NEXT_PUBLIC_*` exposure; `FEATURE_DISABLED` is the tool's honest response while the flag is off.
- The production URL is only rendered when a successful deployment actually recorded one; no URL is ever inferred.
- Registry invariant: the tool set remains a closed allow-list; the exact-set test was updated to include `get_growth_overview` (READ, no confirmation, no `prepare`/`executeApproved`), and forbidden-capability tests still pass.

## 5. A4 — Background-work decision (documented, not built)

Phase 1 found fire-and-forget `void (async () => …)` patterns that lose work on process exit. **This phase deliberately built no job platform, queue, cron, or worker**, because the Growth Overview is a synchronous read-only projection of already-persisted data — it needs no background execution. Nothing in this phase returns a detached promise or claims durability it does not have. Recommendation: any future phase that needs durable work (analytics ingestion, SEO crawls, campaign execution) must first select the platform's job substrate (e.g. a persisted job collection with atomic claim, mirroring the pending-actions pattern already proven in this repo) rather than extending the existing fire-and-forget paths. Until such a substrate exists, features must present work as "happens only while you wait" or not at all.

## 6. Verification outcomes (actual, this machine)

| Check | Command | Result |
|---|---|---|
| Baseline before changes | `npx tsc --noEmit` / `pnpm vitest run` | PASS (77 files / 1016 tests) — no pre-existing failures to distinguish |
| Type check after changes | `npx tsc --noEmit` | PASS (0 errors) |
| Test suite after changes | `pnpm vitest run` | PASS (80 files / 1041 tests; +3 files / +25 tests new) |
| Production build after changes | `pnpm build` | **FAILED — environmental, not code.** Two consecutive runs aborted with `TurbopackInternalError` on `app/globals.css`: the PostCSS-loader helper `node process exited before we could connect ... exit code 0xc0000142` (Windows DLL-initialization failure during process spawn). The failure point touches no file changed in this phase; the bundler could not be run to completion, so **no successful production build is claimed for this phase**. A baseline build of the unmodified tree was not run (would require disturbing preserved working-tree changes). CI (`.github/workflows/ci.yml`) will execute `pnpm build` on a clean Linux runner, where this Windows-specific spawn bug should not reproduce — that is the first real build verification and it has NOT yet occurred. |

New tests cover: availability-state correctness (measured zero ≠ unavailable ≠ not-instrumented, null values, reasons), no-fabrication guarantees, caveat wording, session-scoped ledger queries, site mapping, placeholder-aware AI-plan labeling, deterministic next-step rules, flag semantics (kill switch / hard-on / default / rollout boundaries / fail-safe garbage percent), tool authorization (cross-tenant, missing project, flag-off, forged `userId` ignored), tool payload bounds, and `market` route resolution.

## 7. Out-of-scope discipline (spec section 13)

Not built, not touched: SEO execution/history, campaigns, a tasks system, event/visitor ingestion, provider integrations, revenue-attribution webhook changes, monetization dashboards, new AI assistants, new billing, broad redesign, unrelated refactoring. Pre-existing uncommitted working-tree changes (site pages, docs components, footer/header, probe scripts) were preserved untouched. No commit, push, deploy, or production configuration change was made.

## 8. Known limitations / what is NOT claimed

- The page compiles and its data service is unit-tested with mocked stores; it has not been smoke-tested against a live MongoDB with real project data in this session.
- CI workflow is defined but has not yet executed remotely (no push performed — execution requires the user's commit/push decision).
- `creditsConsumedByProject` reflects only ledger entries with `referenceType: "project"` (collaborate credits). Build/deploy debits reference builds (`build_authorizations`) and are intentionally not attributed, to avoid overstating coverage.
- Runtime usage window is the platform-wide metering record; if a generated app serves traffic without runtime calls, that traffic is invisible — which is exactly why visitors remain `not_instrumented`.

## 9. Phase 3 handoff

Highest-leverage next inputs, in dependency order (consistent with Phase 1's roadmap):
1. **Opt-in visitor analytics ingestion** for deployed apps (requires a privacy posture + SDK snippet decision; then `siteVisitors` moves from `not_instrumented` to measured).
2. **Payments result webhooks interpretation** (Dodo/Stripe for generated apps) so checkout-created can gain completed-payment counterparts — must extend existing webhook handling, not a new pipeline.
3. **Job substrate decision** (section 5) before any campaign/SEO/tasks features.
4. Plan-driven **task/checklist persistence** once durable jobs exist; until then next steps stay deterministic rule outputs as implemented.
5. Nav entries `ads`, `finances`, `lessons`, `resources`, `competition` remain `soon` — activate only with real data behind each.
