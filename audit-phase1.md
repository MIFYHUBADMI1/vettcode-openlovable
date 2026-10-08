# Phase 1 Audit — Team Progress Page

## 1. What exists

### Frontend
- `app/project/[projectId]/progress/page.tsx` — server route, requires owned project, passes initialProject (with events) to `TeamProgressPage`.
- `components/workspace/team-progress.tsx` — "use client" page component. Uses `useProject` (SWR, pollWhileBuilding), `buildProgressViewModel`, `useCofounderPanel`.
- `lib/workspace/progress-view-model.ts` — builds `ProgressViewModel` from `Project` + events. Has `WorkstreamStatus`, `NowState`, `FounderAttentionItem`, `HistoryEntry`, `Deliverable`, `JourneyStageView`. Uses `workspaceNextStep` from `workspace-view-model`.
- `lib/workspace/workspace-view-model.ts` — `WorkspaceNextStep`, `workspaceBrief`, `journeyPhase`, `workspaceNextStep`, `buildWorkspaceView`.
- `lib/workspace/team-roles.ts` — `TEAM_ROLE_META`, `roleForStage` (keyword-based), `isFounderFacingEvent`.
- `lib/workspace/build-handoff.ts` — `parseTeamHandoff` (not wired into progress page currently).
- `lib/workspace/now.ts` — `workspaceIsLive`, `workspaceTeam`.
- `components/workspace/team-handoff.tsx` — renders parsed handoff (not wired into progress page currently).

### Backend
- `app/api/projects/[id]/route.ts` — GET/PATCH/DELETE. PATCH supports sectionUpdate, dismissProposalId, understanding, specification.
- `app/api/projects/[id]/build/route.ts` — POST builds. Uses `claimBuildSlot`, credit reservation, Totalum launch. Sets state `building`.
- `app/api/projects/[id]/deploy/route.ts` — POST deploy, GET status. Uses Totalum deploy. Sets `deploying`, `ready` on success, `build_failed`/`deployment_failed` on failure.
- `app/api/projects/[id]/status/route.ts` — polled GET. Syncs Totalum agent status. Transitions: `building`→`ready` on done, `deploying`→`ready` on success, `building`→`build_failed` on agent failure, `deploying`→`ready` on deploy error.
- `app/api/projects/[id]/agent/route.ts` — POST followup edit. Same build-slot claim, credit reservation, `runAgent`.
- `app/api/projects/[id]/activity/route.ts` — GET events slice.
- `app/api/cofounder/route.ts` — POST turn, GET conversation.
- `app/api/cofounder/actions/[id]/route.ts` — approve/reject pending actions. Atomic claim, revalidation, executeApproved.
- `lib/projects/project-actions.ts` — shared `startProjectBuild`, `sendProjectFollowup`, `startProjectDeploy`, `applyPlanSectionUpdate`. (File too large to read fully; partially read.)
- `lib/cofounder/agent.ts` — `runAgentTurn`, MAX_TOOL_STEPS=6. Uses `generateText` with immediate tools + `prepare_request` bridge.
- `lib/cofounder/tool-registry.ts` — closed registry. Tools: get_workspace_overview, list_projects, get_project, get_project_activity, get_plan, analyze_plan, get_build_status, get_build_logs, get_build_conversation, navigate, get_account_summary, get_credit_costs, stop_build, propose_plan_update, apply_plan_update, autocomplete_plan, create_project, request_build, request_followup_edit, request_deploy, delete_project.
- `lib/cofounder/tools/applications.ts` — request_build, request_followup_edit, request_deploy tools. prepare→pending action, executeApproved→calls shared project-actions.
- `lib/cofounder/pending-actions.ts` — create/claim/finalize pending actions. TTL 15min.
- `lib/store/mongo-store.ts` — MongoStore implements DataStore. Collections: projects, build_runs. Events capped at 200. Build runs tracked.
- `lib/types/project.ts` — Project/MirrorProject, BuildRun, BuildRunStatus, ProjectEvent, DeploymentRecord, DeploymentHistoryEntry, BuildSummary.

## 2. Phase 1 changes present

The progress page is already built and functional:
- `buildProgressViewModel` derives workstream statuses, now section, journey, attention, history, deliverables from project state + events.
- Workstream attribution uses `roleForStage` (keyword matching on event.stage) — not ideal, as noted in spec.
- Founder attention comes from `workspaceNextStep` (review_plan, start_build, retry_build, retry_launch, etc.).
- Retry is represented in `workspaceNextStep` (retry_build, retry_launch kinds) but there's NO dedicated retry endpoint — retry would need to re-trigger build/deploy.
- Co-founder panel is wired via `useCofounderPanel` → opens dialog.
- "Ask your co-founder" button in brief section.

## 3. What's missing for Phase 2

### Real task/job records
- BuildRun exists (build_runs collection) — tracks build id, status, credits, totalumProjectId. This is the real job record.
- BUT: no "current task" concept surfaced. The page derives "now" from project.state, not from an active BuildRun.
- No workstream-level task tracking. No handoff records. No blocker records.

### Retry
- `workspaceNextStep` reports retry_build/retry_launch as needsYou with mutation flags.
- BUT: no retry handler exists. The build route requires a spec and launches a new build. A "retry" after failure would need to re-call the build/deploy endpoint.
- The progress page's attention section would show retry action, but the action href is currently `/project/${projectId}/collaborate` or similar — not a real retry endpoint.

### Founder decisions
- Plan review: `workspaceNextStep` for `plan_ready` returns `review_plan` with href `/project/${projectId}/collaborate`. This is real.
- Build confirmation: `awaiting_build_confirmation` → `start_build` mutation. But there's no separate "confirm build" endpoint — the build route itself is the action.
- The attention section shows these, but the action wiring needs verification.

### Handoffs
- No handoff records exist. `build-handoff.ts` parses a text handoff message but nothing produces that message.
- Phase 2 wants handoffs from real workflow transitions (plan→build, build→preview, etc.).

### Co-founder context
- The co-founder panel can be opened from the progress page (via `useCofounderPanel`).
- When opened, it loads the user's conversation. `activeProjectId` can be passed via `sendCofounderMessage` context.
- BUT: the progress page's "Ask your co-founder" button doesn't pass project context. The panel's `surfaceFromPathname` would pick up the project from the URL, but the progress page is at `/project/[projectId]/progress`, so `surfaceFromPathname` returns `activeProjectId` + `currentSurface: "overview"`. This works.
- However, the co-founder's `buildActiveProjectBrief` fetches the project fresh — so context is real.

### Polling
- `useProject` polls every 3s while building/analyzing/deploying, else 0.
- `useProjectActivity` polls every 5s while building, 60s idle.
- This is reused — good.

## 4. Persistence additions needed

Minimal additive changes:
1. **BuildRun as current task**: Already exists. The progress page should surface the active BuildRun (if state=building and a BuildRun with status=running/reserved exists) as the "current task" rather than just inferring from state.
2. **Handoff record (optional)**: A lightweight `project_handoffs` collection or embed in project doc. But spec says "do not create orphaned records." Since handoffs are derived from transitions, we could derive them from events + state transitions without a new collection. However, for idempotency and traceability, a lightweight handoff log may be warranted. Let's consider: events already record transitions. We can derive handoffs from event sequences. A new collection may not be needed if we're careful.
3. **Retry endpoint**: Not a new persistence need — just a thin wrapper that calls `startProjectBuild` or `startProjectDeploy` when state is failed. But need to be careful: retry after build_failed should re-attempt the build (which requires spec still present). Retry after deployment_failed should re-attempt deploy.
4. **Blocker records**: Not needed as separate collection. Blockers are derived from state (build_failed, deployment_failed) + the last error event.

## 5. Risks

- Don't break existing build/deploy flows.
- Don't introduce a second job engine.
- Retry must be idempotent and respect existing rate limits/credit reservations.
- Don't expose raw provider errors to the founder.

## 6. Summary

Phase 1 is largely present and working. The main gaps for Phase 2:
1. Surface active BuildRun as current task (not just infer from state)
