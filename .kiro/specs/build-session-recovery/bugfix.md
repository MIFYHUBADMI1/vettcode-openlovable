# Bugfix Requirements Document

## Introduction

When a user accidentally leaves the build page during an active build (tab close, browser refresh, navigation, or crash), the Totalum build process continues but Atai loses the ability to track and complete it. The user cannot reconnect to their in-progress or completed build, resulting in lost work, wasted credits, and poor user experience. This fix implements session recovery mechanisms to automatically detect and reconnect to orphaned builds.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user closes the browser tab during an active build THEN the system continues the build in Totalum but never polls for completion status

1.2 WHEN a user refreshes the page during an active build THEN the system continues the build in Totalum but never polls for completion status

1.3 WHEN a user navigates away from the build page during an active build THEN the system continues the build in Totalum but never polls for completion status

1.4 WHEN a user's browser crashes during an active build THEN the system continues the build in Totalum but never polls for completion status

1.5 WHEN a user returns to a project with `totalumProjectId` set and state "building" or "deploying" THEN the system shows the project as building but does not automatically check if the build has already completed

1.6 WHEN a completed build is orphaned (never polled after completion) THEN the user cannot access the built application despite credits being consumed

1.7 WHEN a user views the projects list with abandoned builds THEN the system shows "building" state with no way to resume or recover the build

### Expected Behavior (Correct)

2.1 WHEN a user closes the browser tab during an active build THEN the system SHALL allow reconnection when the user returns and automatically resume status polling

2.2 WHEN a user refreshes the page during an active build THEN the system SHALL automatically resume status polling and show current build progress

2.3 WHEN a user navigates away from the build page during an active build THEN the system SHALL preserve the build state and resume status polling when the user returns

2.4 WHEN a user's browser crashes during an active build THEN the system SHALL allow reconnection when the user returns and automatically resume status polling

2.5 WHEN a user returns to a project with `totalumProjectId` set and state "building" or "deploying" THEN the system SHALL automatically poll the status endpoint and complete the build if it has finished

2.6 WHEN an orphaned build has completed in Totalum THEN the system SHALL detect completion on the next status poll and transition to "ready" state with the development URL

2.7 WHEN a user views the projects list with abandoned builds THEN the system SHALL detect and complete any orphaned builds that have finished, or show accurate in-progress status

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a build is actively being polled THEN the system SHALL CONTINUE TO update progress and handle completion as it currently does

3.2 WHEN a build fails THEN the system SHALL CONTINUE TO transition to "build_failed" state and show the error

3.3 WHEN a project has no `totalumProjectId` and is in "building" state THEN the system SHALL CONTINUE TO reset to "specification_ready" state as a recovery mechanism

3.4 WHEN the status endpoint is called for a project not in "building" or "deploying" state THEN the system SHALL CONTINUE TO return the stored state without polling Totalum

3.5 WHEN concurrent status polls occur for the same project THEN the system SHALL CONTINUE TO use single-flight deduplication to prevent duplicate completion handling

3.6 WHEN a build completes THEN the system SHALL CONTINUE TO reconcile credits, capture screenshots, provision runtime credentials, and push to GitHub as implemented

3.7 WHEN a deployment is in progress THEN the system SHALL CONTINUE TO poll deployment status separately from build status
