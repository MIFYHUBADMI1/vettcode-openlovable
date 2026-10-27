# Build Session Recovery Bugfix Design

## Overview

When a user accidentally closes their browser tab, refreshes the page, or experiences a crash during an active build, the Totalum build process continues but Atai loses the ability to track and complete it. This bugfix implements automatic session recovery by detecting orphaned builds and resuming status polling when the user returns. The fix leverages existing completion logic in the status endpoint and adds auto-resume triggers at three key entry points: workspace page mount, projects list page, and periodic background checks. The solution is minimal, targeted, and preserves all existing build behavior.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user closes/refreshes/crashes during an active build, leaving the project in "building" or "deploying" state with a valid `totalumProjectId` but no active polling
- **Property (P)**: The desired behavior - automatic status poll resumption and build completion detection when the user returns to the project
- **Preservation**: All existing build behavior (active polling, completion logic, credit reconciliation, screenshot capture, GitHub push) must remain unchanged
- **Orphaned Build**: A project in "building" or "deploying" state with a valid `totalumProjectId` but no active status polling (user has left the page)
- **Stale Build**: An orphaned build where the last status poll was more than 5 minutes ago (indicating a session interruption)
- **useProjectStatus**: The React hook in `lib/client/api.ts` that polls `/api/projects/{id}/status` every 10 seconds when `isActive` is true
- **workspaceIsLive**: Helper function that returns true when project state is "building", "deploying", "analyzing", or "planning"
- **Build Completion Logic**: The code in `status/route.ts` (lines 150+) that handles Totalum completion, credit reconciliation, screenshot capture, and GitHub push

## Bug Details

### Bug Condition

The bug manifests when a user's browser session is interrupted during an active build (tab close, refresh, navigation, or crash). The `useProjectStatus` hook stops polling because the component unmounts, but the Totalum build continues. When the user returns to the workspace or views the projects list, the project displays as "building" but no automatic polling resumes to check if the build has actually completed.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { project: Project, userAction: UserAction }
  OUTPUT: boolean
  
  RETURN (input.project.state === "building" OR input.project.state === "deploying")
         AND input.project.totalumProjectId EXISTS
         AND input.userAction IN ["tab_close", "page_refresh", "navigation_away", "browser_crash"]
         AND NO_ACTIVE_STATUS_POLLING_FOR(input.project.id)
END FUNCTION
```

### Examples

- **Tab close during build**: User starts a build, navigates to the workspace page (polling starts), closes the browser tab after 30 seconds. Build continues in Totalum and completes 2 minutes later. User opens the project again 10 minutes later and sees "building" state with no progress - expected: automatic status check on mount detects completion and shows "ready" state with dev URL.

- **Page refresh during build**: User starts a build, workspace page shows build progress. User accidentally refreshes the page at 50% progress. Polling stops during refresh, build continues. Page reloads and mounts again - expected: workspace detects "building" state with `totalumProjectId` on mount, immediately triggers status poll, polling resumes automatically.

- **Browser crash during build**: User starts a build, browser crashes after 1 minute. Build continues and completes 3 minutes later. User reopens browser 20 minutes later, navigates to projects list - expected: projects list detects orphaned build, triggers background status check, project updates to "ready" state reactively.

- **Navigation during deployment**: User triggers deployment, navigates to home page while deploying. Returns to projects list 5 minutes later when deployment is complete - expected: projects list detects "deploying" state with `totalumProjectId`, triggers status check, updates to "ready" with production URL.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Active builds that are currently being polled must continue to update progress exactly as before
- Build completion logic (credit reconciliation, screenshot capture, GitHub push, runtime provisioning) must run identically
- Single-flight deduplication for concurrent status polls must continue to prevent duplicate completions
- Projects without `totalumProjectId` in "building" state must continue to reset to "specification_ready" as a recovery mechanism
- Status endpoint must continue to return stored state for non-active projects without polling Totalum
- The 10-second polling interval for active builds must remain unchanged

**Scope:**
All build behavior that does NOT involve session interruption should be completely unaffected by this fix. This includes:
- Continuous status polling when user stays on the workspace page
- Build completion handling (all existing external calls, DB writes, event logging)
- Error handling for build failures and provider errors
- Deployment status tracking separate from build status
- Build run records and credit reconciliation

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **No Auto-Resume on Workspace Mount**: The `ProjectWorkspace` component in `operating-room.tsx` mounts and reads the project state, but the `useProjectStatus` hook's `isActive` parameter is derived from `workspaceIsLive(projectState)`, which evaluates immediately. However, there's no explicit trigger to resume polling for orphaned builds - the hook waits for the next 10-second interval, assuming polling never stopped. For a build that completed while the user was away, this means the user sees stale "building" state indefinitely.

2. **Projects List Has No Recovery Logic**: The projects list page renders projects but has no mechanism to detect orphaned builds and trigger status checks. Users see projects stuck in "building" state with no way to recover except manually navigating to the workspace page and waiting.

3. **No "Last Polled" Timestamp Tracking**: The system has no concept of when a build was last polled, making it impossible to distinguish between:
   - An actively polled build (user on workspace page, polling every 10 seconds)
   - A recently orphaned build (user closed tab 30 seconds ago, build still running)
   - A stale orphaned build (user left 10 minutes ago, build likely completed)

4. **Status Endpoint Has No Stale Build Detection**: The status endpoint at `status/route.ts` handles orphaned builds with missing `totalumProjectId` (lines 120-137), but has no logic to detect stale builds that have `totalumProjectId` but haven't been polled recently. On first poll after a gap, it should recognize the staleness and immediately fetch Totalum status instead of relying on the next natural poll cycle.

## Correctness Properties

Property 1: Bug Condition - Automatic Build Recovery on Return

_For any_ project where a user returns to the workspace or projects list and the project is in "building" or "deploying" state with a valid `totalumProjectId`, the system SHALL automatically trigger a status poll within 2 seconds of page load and resume normal polling behavior, completing the build if Totalum reports "done" status.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - Active Build Behavior

_For any_ project that is actively being polled (user has not left the page, no session interruption has occurred), the system SHALL produce exactly the same polling behavior, completion logic, and state transitions as the original code, preserving all credit reconciliation, screenshot capture, GitHub push, and runtime provisioning functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct, the fix requires changes in three areas:

**File 1**: `components/workspace/operating-room.tsx`

**Function**: `ProjectWorkspace` component

**Specific Changes**:
1. **Add Auto-Resume Effect**: Add a `useEffect` hook that runs once on mount when the project has `totalumProjectId` and state is "building" or "deploying"
   - Condition: `project?.totalumProjectId && (state === "building" || state === "deploying")`
   - Action: Call `refreshStatus()` immediately to trigger the first status poll
   - Dependencies: `[project?.totalumProjectId, state, refreshStatus]` with a ref guard to fire only once per project
   - This leverages the existing `useProjectStatus` hook which will continue polling every 10 seconds after the initial trigger

2. **Add User Feedback**: Show a toast message "Reconnecting to your build..." when auto-resume is triggered
   - Only show for builds that were orphaned (can detect by checking if `statusData` is null/undefined on mount)
   - Message should use user-facing language ("your project", "the builder"), never mention "Totalum"

**File 2**: `app/api/projects/[id]/status/route.ts`

**Function**: `GET` handler (status endpoint)

**Specific Changes**:
1. **Add lastPolledAt Tracking**: Store a `lastPolledAt` timestamp in the project document
   - Update on every status poll for projects in "building" or "deploying" state
   - Persist via `store.updateProject(id, { lastPolledAt: Date.now() })` before returning response

2. **Add Stale Build Detection**: Before the existing active polling logic (line ~119), check if this is a stale build
   - Condition: `active && project.lastPolledAt && (Date.now() - project.lastPolledAt > 5 * 60 * 1000)`
   - Log: `logger.info("api.projects.status", "stale build detected - resuming", { id, lastPolledAt, gapMs })`
   - Action: Continue to existing Totalum polling logic (no special handling needed - existing completion logic handles everything)
   - This makes the first poll after a gap log the reconnection but otherwise behave identically

3. **Add Recovery Event**: When a stale build is detected and completed, append an event
   - `event("build", "Build completed while you were away - welcome back!")`
   - Only fire if build transitioned from "building" to "ready" on this poll

**File 3**: `app/projects/page.tsx` (or wherever projects list renders)

**Component**: Projects list page

**Specific Changes**:
1. **Add Orphaned Build Detection on Mount**: Add a `useEffect` that runs once on page load
   - Iterate through all projects in the list
   - Find projects with `state === "building" OR state === "deploying"` AND `totalumProjectId` exists
   - For each orphaned project, trigger a background status check via `fetch(`/api/projects/${id}/status`)`
   - Use a Set to track which projects have been checked to avoid duplicate fetches

2. **Add Background Status Polling**: For orphaned builds detected in step 1
   - Trigger immediate status check (don't wait for first interval)
   - Let the existing SWR cache and UI refresh handle updates
   - Projects list should reactively update when status changes (existing behavior)

**File 4** (Optional - Future Enhancement): `lib/cron/build-recovery.ts`

**Function**: Periodic background job (cron or serverless function)

**Specific Changes**:
1. **Query Stale Builds**: Find all projects where `state IN ["building", "deploying"]` AND `totalumProjectId` exists AND `lastPolledAt < NOW() - 5 minutes`

2. **Poll Totalum Status**: For each stale build, call the existing status endpoint or directly call `getAgentStatus`

3. **Complete If Done**: If Totalum reports "done", trigger the existing completion logic

4. **Rate Limiting**: Only process up to 10 stale builds per run to avoid overwhelming Totalum

5. **Logging**: Log all recovery attempts for observability

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by manually interrupting build sessions, then verify the fix works correctly and preserves existing behavior through property-based testing of the recovery logic.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis (no auto-resume, no stale detection, no projects list recovery). If we refute, we will need to re-hypothesize.

**Test Plan**: Start real builds in the Atai app, interrupt the session in various ways (tab close, refresh, navigation, crash simulation), then return and observe whether status polling resumes. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Tab Close Test**: Start build, navigate to workspace (polling starts), close tab after 30s, wait 2 minutes, reopen project - observe that workspace shows "building" with no progress updates, no automatic completion (will fail on unfixed code)

2. **Page Refresh Test**: Start build, wait until 50% progress, hard refresh the page - observe that polling does not immediately resume, build appears frozen (will fail on unfixed code)

3. **Navigation Test**: Start build, navigate to home page, return to projects list - observe that project shows "building" with no status check triggered (will fail on unfixed code)

4. **Deployment Interruption Test**: Start deployment, close tab, wait 5 minutes, reopen projects list - observe that project shows "deploying" with no completion detection (will fail on unfixed code)

5. **Completed Build Orphan Test**: Start build, close tab immediately, wait 5 minutes for build to complete in Totalum, reopen workspace - observe that project shows "building" indefinitely despite build being done (will fail on unfixed code)

**Expected Counterexamples**:
- Workspace page mounts but does not trigger immediate status poll for orphaned builds
- Projects list renders orphaned builds but does not trigger background status checks
- Status endpoint has no concept of "stale" builds and treats first poll after gap identically to continuous polling
- Possible causes: no mount-time polling trigger, no lastPolledAt tracking, no projects list recovery logic

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (user returns to orphaned build), the fixed system produces the expected behavior (automatic status poll, completion detection, reactive UI update).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  // User returns to workspace or projects list
  result := mountWorkspaceOrProjectsList(input.project)
  
  // System should trigger immediate status poll
  ASSERT statusPollTriggered(input.project.id, withinSeconds: 2)
  
  // If build completed in Totalum, system should detect and complete
  IF totalumReports(input.project.totalumProjectId, status: "done") THEN
    ASSERT projectTransitionsTo(input.project.id, state: "ready")
    ASSERT developmentUrlIsSet(input.project.id)
    ASSERT creditsReconciled(input.project.id)
  END IF
END FOR
```

**Testing Approach**: Property-based testing is ideal here because we can generate many different scenarios:
- Different build progress percentages when interruption occurs (0%, 25%, 50%, 75%, 99%)
- Different interruption types (tab close, refresh, navigation, crash)
- Different time gaps between interruption and return (10s, 1m, 5m, 30m)
- Different Totalum completion states when user returns (still running, just completed, completed 5 minutes ago)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (active continuous polling, no interruption), the fixed system produces exactly the same result as the original system.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // User stays on workspace page, no interruption
  result_original := statusPolling_original(input.project)
  result_fixed := statusPolling_fixed(input.project)
  
  ASSERT result_original.state === result_fixed.state
  ASSERT result_original.developmentUrl === result_fixed.developmentUrl
  ASSERT result_original.completionBehavior === result_fixed.completionBehavior
  ASSERT result_original.creditReconciliation === result_fixed.creditReconciliation
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (different project states, different build durations, different completion scenarios)
- It catches edge cases that manual unit tests might miss (e.g., concurrent polls, deployment vs build, provider errors)
- It provides strong guarantees that behavior is unchanged for all non-interrupted builds

**Test Plan**: Observe behavior on UNFIXED code first for active builds (user stays on page, polling continues), then write property-based tests capturing that behavior and run on FIXED code to verify preservation.

**Test Cases**:
1. **Active Build Preservation**: Start build, stay on workspace page, observe polling every 10 seconds, build completes, verify all completion steps (credit reconciliation, screenshot, GitHub push) - then verify FIXED code does exactly the same

2. **Build Failure Preservation**: Start build, stay on page, simulate Totalum failure, verify transition to "build_failed" state with error event - then verify FIXED code does exactly the same

3. **Orphaned No-ID Recovery Preservation**: Create project in "building" state with no `totalumProjectId`, trigger status endpoint, verify reset to "specification_ready" - then verify FIXED code does exactly the same

4. **Single-Flight Deduplication Preservation**: Start build, trigger multiple concurrent status polls, verify only one completion handler runs - then verify FIXED code does exactly the same

5. **Deployment Status Preservation**: Start deployment, stay on page, observe separate deployment polling, verify completion with production URL - then verify FIXED code does exactly the same

### Unit Tests

- Test workspace mount auto-resume trigger fires when `totalumProjectId` exists and state is "building"
- Test workspace mount does NOT trigger auto-resume when state is "ready" or "plan_ready"
- Test status endpoint updates `lastPolledAt` on every poll for active projects
- Test status endpoint detects stale builds (lastPolledAt > 5 minutes) and logs reconnection
- Test projects list detects orphaned builds on mount and triggers background status checks
- Test projects list does NOT trigger status checks for projects in "ready" or "plan_ready" state

### Property-Based Tests

- Generate random build interruption scenarios (different states, time gaps, completion states) and verify auto-resume always triggers status poll
- Generate random active build scenarios (no interruption) and verify polling behavior is identical to original code
- Generate random project lists with mix of active/orphaned/completed builds and verify only orphaned builds get status checks
- Test concurrent status polls during recovery do not cause duplicate completion handling

### Integration Tests

- Full flow: Start build → close tab after 30s → wait 3 minutes → reopen workspace → verify automatic completion with dev URL, credits reconciled, screenshot captured
- Deployment flow: Start deployment → refresh page → verify deployment completes with production URL
- Projects list flow: Start build → navigate away → return to projects list → verify background recovery updates UI reactively
- Stale build flow: Simulate lastPolledAt = 10 minutes ago → trigger status poll → verify stale detection logs and completion proceeds normally
