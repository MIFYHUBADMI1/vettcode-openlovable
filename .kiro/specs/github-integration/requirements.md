# Requirements Document

## Introduction

This feature adds GitHub integration to MirrorSite AI across three dimensions:

1. **Sign in with GitHub** — GitHub OAuth as a first-class authentication method alongside email/password and Google OAuth. Full scopes (`repo`, `read:user`, `user:email`) are requested at sign-in time. The GitHub access token, GitHub user ID, and GitHub username are persisted on the `UserDoc`. The `AuthProvider` union is extended to include `"github"`.

2. **Push to GitHub** — A per-project integration where the user connects their GitHub account to a MirrorSite project and selects the "push" direction. The user picks a target repository (new or existing). An initial push of the project's source code (from `getSourceCode()`) is performed immediately. Every subsequent successful build triggers an automatic push.

3. **Build from GitHub** — A per-project integration where the user connects GitHub to a project and selects the "build-from" direction. A GitHub repository is selected as the analysis source. `"github"` becomes a third `ProjectMode`. The repository's README and code files are fetched via the GitHub API and used as the planning source instead of Firecrawl website crawling.

Per-project GitHub connection state is stored in a dedicated `ProjectGitHubDoc` collection (fields: `mode: "push" | "build-from"`, `repoOwner`, `repoName`, `branch`).

## Glossary

- **GitHubOAuth**: The GitHub OAuth 2.0 authorization code flow used for authentication and authorization.
- **GitHubAccessToken**: The OAuth access token issued by GitHub and stored on `UserDoc`. Used for all GitHub API calls on behalf of the user.
- **UserDoc**: The MongoDB user document defined in `lib/types/db.ts`. Stores authentication identity and credit balance.
- **ProjectGitHubDoc**: A new MongoDB collection document linking a MirrorSite project to a GitHub repository and recording the integration direction.
- **ProjectMode**: The `"website" | "scratch"` union in `lib/types/project.ts`, extended to `"website" | "scratch" | "github"`.
- **AuthProvider**: The `"password" | "google"` union in `lib/types/db.ts`, extended to `"password" | "google" | "github"`.
- **SourceCodeZip**: The signed ZIP archive URL returned by `getSourceCode(projectId)` in `lib/integrations/totalum/service.ts`.
- **GitHubAPI**: The GitHub REST API v3 (`https://api.github.com`), accessed with `Authorization: Bearer <GitHubAccessToken>`.
- **OAuthState**: A cryptographically random, short-lived CSRF nonce stored in an `HttpOnly` cookie, verified on callback.
- **BuildRun**: A single Totalum build execution tracked by `BuildRun` in `lib/types/project.ts`.
- **PushTrigger**: The event that fires an automatic source-code push to GitHub after a `BuildRun` reaches `status: "succeeded"`.
- **RepoContents**: The set of files fetched from a GitHub repository (README + code files) used as analysis input for "build-from" projects.

---

## Requirements

### Requirement 1 — GitHub OAuth Sign-In Initiation

**User Story:** As a visitor, I want to sign in or register with my GitHub account, so that I can use MirrorSite AI without managing a separate password.

#### Acceptance Criteria

1. WHEN a user navigates to `/api/auth/github`, THE GitHubOAuth SHALL redirect the user's browser to GitHub's authorization endpoint with `scope` set to `repo read:user user:email`, a cryptographically random `state` nonce, and the registered `redirect_uri`.
2. WHEN the OAuth initiation request includes a `next` query parameter containing a path that starts with `/` and does not start with `//`, THE GitHubOAuth SHALL encode that path into the `state` value for post-login redirect.
3. WHEN the OAuth initiation request includes a `ref` query parameter, THE GitHubOAuth SHALL persist the referral code in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie named `mirrorsite_referral` with a maximum age of 10 minutes.
4. THE GitHubOAuth SHALL persist the `state` nonce in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie named `mirrorsite_github_oauth_state` with a maximum age of 10 minutes.

---

### Requirement 2 — GitHub OAuth Callback and Account Resolution

**User Story:** As a user who has authorized MirrorSite on GitHub, I want the system to log me in or create my account automatically, so that I am taken directly to my workspace.

#### Acceptance Criteria

1. WHEN the GitHub callback route receives a `code` and `state` parameter, THE GitHubOAuth SHALL verify that the `state` nonce matches the value stored in the `mirrorsite_github_oauth_state` cookie before processing the code.
2. IF the `state` nonce does not match or the `code` parameter is absent, THEN THE GitHubOAuth SHALL redirect the browser to `/login?error=github_auth_failed` without performing any token exchange.
3. WHEN the nonce verification succeeds, THE GitHubOAuth SHALL exchange the `code` for a GitHub access token by sending a `POST` request to `https://github.com/login/oauth/access_token`.
4. WHEN the access token is obtained, THE GitHubOAuth SHALL fetch the authenticated user's profile from `https://api.github.com/user` and primary email from `https://api.github.com/user/emails` using the access token.
5. WHEN the GitHub profile is obtained and a `UserDoc` with a matching `githubId` already exists, THE GitHubOAuth SHALL log in that user without creating a new account.
6. WHEN the GitHub profile is obtained, no `UserDoc` matches `githubId`, and a `UserDoc` with the same primary email exists, THE GitHubOAuth SHALL link the GitHub identity to the existing account by writing `githubId`, `githubUsername`, and `githubAccessToken` onto that `UserDoc` and log in the existing user.
7. WHEN the GitHub profile is obtained and no matching `UserDoc` exists by `githubId` or email, THE GitHubOAuth SHALL create a new `UserDoc` with `authProvider: "github"`, `githubId`, `githubUsername`, `githubAccessToken`, `emailVerified: true`, and grant 500 permanent welcome credits via the credit service using idempotency key `signup_<userId>_github`.
8. WHEN the resolved user has `banned: true` or `suspended: true`, THE GitHubOAuth SHALL redirect the browser to `/login?error=account_banned` or `/login?error=account_suspended` respectively, without creating a session.
9. WHEN account resolution succeeds and the user is not banned or suspended, THE GitHubOAuth SHALL create a session, set the session cookie, delete the `mirrorsite_github_oauth_state` cookie, and redirect the browser to the `next` path extracted from the state (defaulting to `/workspace`).
10. WHEN the resolved user is a new user and a `mirrorsite_referral` cookie is present, THE GitHubOAuth SHALL attempt referral capture and then delete the `mirrorsite_referral` cookie.

---

### Requirement 3 — GitHub Identity Fields on UserDoc

**User Story:** As the system, I need to store GitHub identity and token data on the user record so that GitHub API calls can be made on behalf of the user.

#### Acceptance Criteria

1. THE UserDoc SHALL include an optional `githubId` field of type `string` that stores the GitHub user's numeric ID as a string.
2. THE UserDoc SHALL include an optional `githubUsername` field of type `string` that stores the GitHub login handle.
3. THE UserDoc SHALL include an optional `githubAccessToken` field of type `string` that stores the OAuth access token issued by GitHub.
4. THE AuthProvider type SHALL include `"github"` as a valid value alongside `"password"` and `"google"`.
5. WHEN a GitHub-authenticated user's access token is refreshed or the user re-authorizes, THE GitHubOAuth SHALL overwrite the existing `githubAccessToken` on the `UserDoc` with the new token.

---

### Requirement 4 — Project GitHub Integration Connection

**User Story:** As a user, I want to connect a GitHub repository to my project and choose whether to push my code to GitHub or build from a GitHub repo, so that I can manage my code with GitHub.

#### Acceptance Criteria

1. WHEN a user connects a GitHub repository to a project, THE System SHALL create or update a `ProjectGitHubDoc` in the `project_github` collection with fields `projectId`, `userId`, `mode` (`"push"` or `"build-from"`), `repoOwner`, `repoName`, `branch`, `createdAt`, and `updatedAt`.
2. THE System SHALL enforce that each project has at most one `ProjectGitHubDoc` (one integration per project) using a unique index on `projectId`.
3. WHEN creating or updating a `ProjectGitHubDoc`, THE System SHALL verify that the authenticated user owns the referenced project before writing.
4. WHEN a `ProjectGitHubDoc` with `mode: "push"` is created, THE System SHALL verify that the authenticated user's `githubAccessToken` has write access to the specified `repoOwner/repoName` by calling `GET /repos/{owner}/{repo}` on the GitHubAPI and confirming `permissions.push: true` in the response.
5. IF the user's `githubAccessToken` is absent or expired when connecting a repository, THEN THE System SHALL return an error code `GITHUB_AUTH_REQUIRED` instructing the client to re-authenticate via GitHub OAuth before proceeding.

---

### Requirement 5 — Repository Selection for Push Mode

**User Story:** As a user setting up a "push" integration, I want to pick an existing repository or create a new one on GitHub, so that my project's code is sent to the right place.

#### Acceptance Criteria

1. WHEN a user requests the list of their GitHub repositories, THE System SHALL call `GET /user/repos` on the GitHubAPI with the user's `githubAccessToken` and return the list including `full_name`, `default_branch`, and `permissions.push` for each repository.
2. WHEN a user requests the creation of a new GitHub repository, THE System SHALL call `POST /user/repos` on the GitHubAPI with the user's `githubAccessToken` and the requested repository name and private/public setting.
3. IF the GitHubAPI returns a non-2xx status when listing or creating repositories, THEN THE System SHALL return an error response with code `GITHUB_API_ERROR` and the HTTP status received from GitHub.

---

### Requirement 6 — Initial Push on Integration Setup

**User Story:** As a user who just connected a "push" integration, I want my current source code pushed to GitHub immediately, so that the repository starts with the latest state of my project.

#### Acceptance Criteria

1. WHEN a `ProjectGitHubDoc` with `mode: "push"` is saved and the project has a `totalumProjectId`, THE System SHALL call `getSourceCode(totalumProjectId)` to obtain the `SourceCodeZip` download URL.
2. WHEN the `SourceCodeZip` URL is obtained, THE System SHALL download the ZIP archive, unpack all files, and push each file to the target GitHub repository using the GitHubAPI tree/commit/ref update flow under the specified `branch`.
3. IF `getSourceCode` returns a `downloadUrl` of `null`, THEN THE System SHALL skip the initial push and record a `pushStatus: "skipped_no_source"` on the `ProjectGitHubDoc`.
4. WHEN the initial push completes successfully, THE System SHALL record `lastPushedAt` (epoch ms) and `lastPushedSha` (the new commit SHA) on the `ProjectGitHubDoc`.
5. IF the GitHubAPI returns a non-2xx status during the push, THEN THE System SHALL record `pushStatus: "failed"` and `pushError` with the error message on the `ProjectGitHubDoc` without rethrowing, so the integration setup itself does not fail.

---

### Requirement 7 — Automatic Push After Successful Build

**User Story:** As a user with a "push" integration, I want my project's source code automatically pushed to GitHub after every successful build, so that my GitHub repository stays in sync without manual action.

#### Acceptance Criteria

1. WHEN a `BuildRun` transitions to `status: "succeeded"` and the project has a `ProjectGitHubDoc` with `mode: "push"`, THE System SHALL trigger a push of the updated source code to the configured GitHub repository.
2. WHEN the post-build push is triggered, THE System SHALL call `getSourceCode(totalumProjectId)`, download and unpack the ZIP, and push all files to the target branch using the GitHubAPI.
3. WHEN the automatic push completes successfully, THE System SHALL update `lastPushedAt` and `lastPushedSha` on the `ProjectGitHubDoc`.
4. IF the automatic push fails for any reason, THEN THE System SHALL record `pushStatus: "failed"` and `pushError` on the `ProjectGitHubDoc` and log the error, without affecting the `BuildRun` status or charging the user additional credits.
5. THE System SHALL perform the automatic push asynchronously so that the build completion response is returned to the client before the push operation begins.

---

### Requirement 8 — Build-from GitHub Mode

**User Story:** As a user, I want to use a GitHub repository as the source for my MirrorSite project instead of a website URL, so that I can build an application based on existing code.

#### Acceptance Criteria

1. WHEN a project is created with `mode: "github"`, THE System SHALL accept a `ProjectGitHubDoc` with `mode: "build-from"`, `repoOwner`, `repoName`, and `branch` as part of the creation flow.
2. WHEN the analysis phase begins for a project with `mode: "github"`, THE System SHALL fetch the repository's README file by calling `GET /repos/{owner}/{repo}/readme` on the GitHubAPI and decode the base64 content.
3. WHEN the analysis phase begins for a project with `mode: "github"`, THE System SHALL fetch the repository's file tree by calling `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` on the GitHubAPI and retrieve the contents of code files (extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.go`, `.rb`, `.java`, `.cs`, `.php`, `.html`, `.css`) up to a combined limit of 500 files or 2 MB of total content, whichever is reached first.
4. WHEN the README and code file contents are assembled, THE System SHALL pass them to the planning pipeline as the analysis source in place of Firecrawl crawled content.
5. IF the GitHubAPI returns a 404 for the README, THEN THE System SHALL proceed with an empty README string rather than failing the analysis.
6. IF the GitHubAPI returns a non-2xx status (other than 404 for README) during content fetching, THEN THE System SHALL transition the project to `state: "build_failed"` and record `error: "GITHUB_FETCH_FAILED"` on the project document.
7. THE ProjectMode type SHALL include `"github"` as a valid value alongside `"website"` and `"scratch"`.

---

### Requirement 9 — Token Security and Storage

**User Story:** As the system operator, I need GitHub access tokens stored and transmitted securely, so that user accounts are not compromised if the database is read.

#### Acceptance Criteria

1. THE System SHALL store `githubAccessToken` values in the `users` MongoDB collection only, never in session documents, cookies, or client-visible API responses.
2. WHEN an API route returns user profile data to the client, THE System SHALL omit the `githubAccessToken` field from the serialized response.
3. WHEN constructing GitHubAPI requests, THE System SHALL send the `githubAccessToken` only in the `Authorization: Bearer <token>` header and never in URL query parameters.
4. THE System SHALL treat all content returned by the GitHubAPI (repository names, file contents, README text) as untrusted input and apply the same input validation and length limits used for other external content sources.

---

### Requirement 10 — GitHub Integration UI Entry Point

**User Story:** As a user, I want a clearly labeled GitHub integration option on my project settings page, so that I can set up or change the GitHub integration without confusion.

#### Acceptance Criteria

1. WHEN a user views the integrations section of a project that has no `ProjectGitHubDoc`, THE System SHALL display a "Connect GitHub" option showing both the "push" and "build-from" directions for the user to choose between.
2. WHEN a user views the integrations section of a project that has an existing `ProjectGitHubDoc`, THE System SHALL display the current integration mode, the connected `repoOwner/repoName`, the `branch`, and a "Disconnect" action.
3. WHEN a user selects "Disconnect", THE System SHALL delete the `ProjectGitHubDoc` for that project after confirming the action with the user.
4. WHEN a user who has no `githubAccessToken` on their `UserDoc` attempts to connect a GitHub integration, THE System SHALL redirect the user through the GitHub OAuth flow before presenting the repository selection screen.
