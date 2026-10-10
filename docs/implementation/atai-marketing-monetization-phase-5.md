# Atai Marketing & Monetization — Phase 5 implementation report

**Phase:** W4 — Growth tasks & execution management (founder-approvable next-step tasks on a durable, change-logged task list)
**Date:** 2026-10-10
**Branch:** `main` (changes left uncommitted for review — nothing was committed, pushed, or deployed)
**Predecessor:** `docs/implementation/atai-marketing-monetization-phase-4.md` (Phase 4 — AI Marketing Studio)
**Roadmap source:** Phase 1 audit section 14 — W4 (prereqs Phase 0 jobs, W1–W3)

---

## 1. Scoping call up front — the job substrate does not exist

Roadmap W4 lists the prerequisite as "Phase 0 jobs." **This repository has no job/scheduler substrate**: no job collection, no cron/worker/queue, and the only atomic-claim mechanism that exists is the co-founder pending-action claim (`claimPendingAction`). Verification for this phase (three independent codebase searches) found no persisted job runner anywhere.

So "execution management" here means **durable task management + un-bypassable approval of AI-proposed tasks**, NOT scheduled execution. This phase ships the job-free portion that fully satisfies the stated W4 acceptance criteria — *"task lifecycle e2e; approvals un-bypassable server-side"* — and deliberately does **not** fake a scheduler. Scheduled/auto execution, publish, and campaign runs stay deferred to a real job substrate (same honest posture as the W2/W3 publish deferrals). No timing/cron code was added.

## 2. What was implemented (production code, not a plan)

| Area | Deliverable | Files |
|---|---|---|
| Durable task store | Two additive collections — `growth_tasks` and append-only `growth_task_history` (raw Mongo, dual `_id: ObjectId` + string `id`). NEVER embedded in `projects`. Indexes: `growth_tasks_id_unique` / `growth_task_history_id_unique` (unique+sparse), `{projectId,status,updatedAt}`, `{userId,createdAt}`, `{taskId,createdAt}`. | `lib/types/db.ts` (`GrowthTaskDoc`, `GrowthTaskHistoryDoc`, status/priority/origin unions), `lib/db/collections.ts` (`growthTasksCol`, `growthTaskHistoryCol` + index block) |
| Task service | `createGrowthTask` / `listTasks` / `getTask` / `updateTaskStatus` / `updateTaskFields` / `getTaskHistory`. Tenant-scoped; **re-asserts `project.userId === userId` via `store.getProject` BEFORE every write** and fails closed (`UNAUTHORIZED_PROJECT_ACCESS`); empty title → `VALIDATION`; `dueAt`/`completedAt` are a real `null` (unknown/absent), never 0; `completedAt` is set only on the open→done edge and cleared on reopen; **every create/status/field change appends an immutable history row**. | `lib/marketing/tasks/service.ts` (+ test, 12) |
| §6 Co-founder tools | CONFIRM `propose_growth_task` (`prepare()` flag+ownership-gates and creates a pending action WITHOUT persisting; `executeApproved()` re-gates then persists an `ai_generated` task; returns `navigation: { target: "tasks" }`). READ `list_growth_tasks` (immediate, bounded projection, same `ownedProject` gate). **Tasks are FREE — no charge/refund path.** | `lib/cofounder/tools/tasks.ts` (+ test, 12), `tool-registry.ts`, `schemas.ts` (`proposeGrowthTaskSchema`, `listGrowthTasksSchema`), `types.ts` (`growth_task`, `growth_tasks_list` result types) |
| Direct API | `/api/projects/:id/tasks` — GET lists the founder's own tasks + the deterministic rule-based next-step seeds (from the trusted growth view); POST creates (free); PATCH changes status and/or edits title/priority/due. Session-auth, fail-closed ownership (uniform 404), rate-limited, flag-gated. **The client may only stamp `user_created` / `next_step_seed` origins — `ai_generated` is reserved for the approval-gated tool and cannot be forged here.** | `app/api/projects/[id]/tasks/route.ts` |
| Feature flag (default OFF) | `isGrowthTasksEnabledForUser(userId)` — same env + deterministic-percent convention, **defaults OFF**; hard-on / kill-switch / fail-safe garbage→off. When off the route renders the exact coming-soon page, the API refuses (403/`enabled:false`), and both tools refuse loudly. | `lib/marketing/feature-flags.ts` (+ test, 5 new cases → 20 total) |
| Tasks surface | `/project/[projectId]/tasks` page mirroring the studio/market routes (flag-gated, coming-soon fallback, page load is free + read-only); `GrowthTasksPanel` lists open/done/dismissed, creates tasks, offers "Add as task" on each rule-based next step, and moves tasks between statuses — all labeled "manual to-do, nothing runs on a schedule, never a measured result." | `app/project/[projectId]/tasks/page.tsx`, `components/marketing/growth-tasks-panel.tsx` |
| §69 Navigation registry | New project target `tasks` → `/project/[id]/tasks` (the AI still never authors an href). | `lib/navigation/routes.ts` (+ test) |

No new dependencies, no new secrets, no changes to shared billing/auth/build logic, no `specification` schema change. `TaskResultType` only gained new members — verified there is no exhaustive `switch` over it (the action-card renderer uses `if` chains and the only `switch` is over the unchanged `CofounderMessageAction.kind`), so no existing client path breaks.

## 3. Next-steps → tasks, honestly

The rule-based `deriveNextSteps` (Phase 2) is the trusted seed. The Tasks page reads the SAME `getGrowthOverview(...).nextSteps` the `/market` page shows (single source of truth, no reimplementation) and offers "Add as task." Turning a seed into a task sets `origin: "next_step_seed"` and keeps `sourceNextStepId` as a link only. AI-proposed tasks arrive separately via `propose_growth_task` and are labelled `origin: "ai_generated"`. Every task UI surface states that completing a task is not a measured outcome and nothing runs automatically.

## 4. Trust posture (carried from Phases 2–4)

- A task is a **manual to-do**, never an executed action: `origin` labels provenance (AI-proposed / founder / next-step-seed); no field, UI affordance, or tool claims execution, scheduling, or a result.
- **No scheduler is faked.** `dueAt`/`completedAt` are real `null` when absent; there is no `scheduledFor`/`ranAt`/`cron` anywhere.
- History is **append-only and immutable** — a create/status/field change adds a new row; nothing rewrites past rows, so the lifecycle is durably inspectable.

## 5. Security posture actually applied

- **Ownership fail-closed everywhere.** Page: `requireOwnedProject` (uniform 404). API: `checkProjectOwnership` → uniform 404 (`UNAUTHORIZED_PROJECT_ACCESS`). Tool: `ownedProject(ctx, projectId)` with the session `ctx.user.id`. The service ALSO re-asserts `project.userId === userId` before every write as defense in depth and refuses WITHOUT persisting when it fails (asserted in tests).
- **No client-supplied `userId` is ever trusted.** The service receives the session id (`ctx.user.id` / `requireUser().id`); schemas `.strip()` unknown keys; tests prove the session id (not a model/user payload) reaches `createGrowthTask`.
- **Approvals are un-bypassable server-side.** `propose_growth_task` is `CONFIRM`: `prepare()` persists NOTHING and only creates a pending action; the write happens in `executeApproved()` after the framework's atomic claim (a retried/double approval cannot double-create because the claim is atomic). The direct API cannot mint an `ai_generated` origin — the only path that persists an AI-proposed task is the approval-gated tool.
- **Origin is a server-side allow-list** at the API boundary (`user_created` / `next_step_seed` only); `ai_generated` is not settable by a client.
- **Rate limited** (create 60/hr, update 120/hr per user). **Flag server-side only**, default OFF; no `NEXT_PUBLIC_*` exposure.
- **Registry invariant preserved.** The exact-set test now includes BOTH `propose_growth_task` (CONFIRM: has `prepare`+`executeApproved`, no `execute`) and `list_growth_tasks` (READ: has `execute`, no confirm path); forbidden-capability and risk-ladder tests still pass.

## 6. Out-of-scope discipline

Not built, not touched: scheduled/auto execution, a job/cron/worker substrate, publish, campaign execution, cross-project dashboard aggregation, or any change to the `specification` schema or shared billing/auth/build internals. The Tasks page is intentionally NOT wired into the cross-project dashboard card grid: the feature flag is server-only (never exposed to the browser), the dashboard is fully client-rendered, and adding a per-user aggregated "tasks" card would require a new cross-project endpoint + client hook and restructuring existing cards — outside safe additive scope and not needed for the acceptance criteria. The next-step→task integration therefore lives on the Tasks page itself (the "Suggested next steps" section), which is the honest, flag-safe surface.

## 7. Verification outcomes (actual, this machine)

All commands run on this Windows host (`C:\Users\USER\Desktop\mirrorsiteai`). No CI, no deploy, no production build was executed (see §8).

**Phase 5 type check** — scoped `tsc --noEmit` over the W4 file set (the two new collections' types + accessors, `tasks/service.ts`, the two tools, `tool-registry.ts`, `schemas.ts`, `cofounder/types.ts`, `routes.ts`, `feature-flags.ts`, the API route, the page, the panel, and their tests) — `tsconfig.tasks-check.json`, transient.
- Result: **clean (`TASKS_TSC_EXIT=0`)**.
- First run surfaced 4 errors — all one root cause: a duplicate `import { proposeGrowthTaskTool, listGrowthTasksTool }` line accidentally written into `tool-registry.ts` by a repeated edit. Removed the duplicate line; the re-run is clean.
- The tree-wide `tsc` and `next build` were NOT run — pathologically slow / broken on this host (Turbopack worker-spawn failures), same constraint as Phases 2–4.

**Targeted W4 suite** — `npx vitest run` over `marketing/tasks/service`, `cofounder/tools/tasks`, `cofounder/tool-registry`, `marketing/feature-flags`, `navigation/routes`:
- Result: **`Test Files 5 passed (5)` · `Tests 61 passed (61)`** (`TASKS_VITEST_EXIT=0`).

**Full test suite** — `npx vitest run` (all files):
- Result: **`Test Files 89 passed (89)` · `Tests 1151 passed (1151)`** (`FULL_VITEST_EXIT=0`, ~183s). That is Phase 4's 87/1122 plus exactly the 29 new Phase 5 tests (12 `tasks/service` + 12 `cofounder/tools/tasks` + 5 new `feature-flags` cases) — no pre-existing suite regressed.

**NOT claimed:** no live-MongoDB integration run, no live model call, no `pnpm build`, no deploy, no production smoke test. The service + tool contracts are unit-tested against a mocked store/collections; `getGrowthOverview` is reused (not re-verified) as the next-step seed source.

## 8. Known limitations / what is NOT claimed

- Compiles (scoped) and the service + tool contracts are unit-tested with mocked store/collections; **not** smoke-tested against a live MongoDB this session, so index creation and the real query plans are unproven on a live server.
- **No scheduled execution** (by design — the job substrate does not exist and was not fabricated). Tasks are a manual list; `dueAt` is recorded but never acts as a trigger.
- History is best-effort-append: if the history insert fails the primary task mutation is not rolled back, but the failure is logged loudly (a broken audit trail is never silent). This is a deliberate availability choice, not a guarantee of exactly-once history.
- The cross-project dashboard next-step card is intentionally deferred (§6); the next-step→task surface is on the Tasks page.
- A green production build has not been demonstrated on this host this session (same environmental Turbopack/`tsc` constraints as Phases 2–4); CI is the first real build check.

## 9. Phase 6 handoff

1. **Job substrate is still the gate** (Phase 2 §5 / Phase 3 §4 / this phase §1): a persisted job collection with an atomic claim (mirror `claimPendingAction`) BEFORE any scheduled execution, recurring SEO re-crawls, or publish/campaign automation. With it, `growth_task_history` gains an "executed by job X" link and `dueAt` becomes actionable.
2. **Cross-project task rollup** for the dashboard once it is safe to expose (a server route that returns per-project open-task counts, gated by the same flag) — then a flag-aware card, without restructuring the existing grid.
3. **Task → Studio/SEO linkage**: allow completing a task to reference the exact draft/audit that fulfilled it (link-only, never embedded), turning the task list into an evidence trail over already-built artifacts.
4. **Richer task UX** within the free, manual boundary: reordering, bulk triage, and per-task detail editing already wired via `updateTaskFields` — surface them without adding any execution/automation semantics.
