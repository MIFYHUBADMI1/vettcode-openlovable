# ATai Product & Dashboard Audit

> **Audit type:** Read-only inspection. Nothing in the codebase was modified, installed, fixed, or redesigned.
> **Method:** Static code inspection of routes, components, hooks, API routes, data-store contracts, pipeline code, and spec documents. **No dev server was run and no screenshots were captured** (static inspection only — see §28).
> **Sources:** Every technical claim cites a file path (and function/component where relevant).
> **Status legend:** CONFIRMED = read directly in code · INFERRED = derived from code behavior · UNKNOWN/NOT IMPLEMENTED = searched for and absent.

---

## 1. Executive Summary

Atai (`package.json` → `"name": "atai", "version": "5.0.0"`) is an AI business-building platform for non-technical founders. A founder submits an **idea**, a **competitor URL**, or a **GitHub repo**; Atai runs an analysis pipeline that produces an editable, plain-language **application plan** (business + technical specification). The founder refines it with an **AI Co-Founder** chat on the Collaborate page, then confirms to launch a **Totalum-powered full-stack build**, which yields a preview URL, a database UI, source-code export, GitHub push, and deployment to a subdomain or custom domain.

The current dashboard (`app/dashboard/page.tsx`) is a lightweight, **100% real-data** page: greeting, recent projects (top 4), an onboarding checklist derived from the newest project's lifecycle state, a static Explore promo, and a static referral promo. It contains **no mock data** — but also **no business-state overview**: no cross-project milestone view, no "what Atai did while you were away", no usage snapshot, no sidebar.

Headline findings for a future redesign:

1. The dashboard is **project-list-centric, not business-state-centric**. The lifecycle model is rich (14 persisted states) but the dashboard surfaces almost none of it.
2. There is a **half-finished pivot**: `.kiro/specs/atai-pivot/requirements.md` describes plans (Free/Explorer/Launch/Growth/Scale/Enterprise), an Atai SDK, a Business Overview tab, and a 4-step onboarding dialog that are **not present in code**. The pricing page in code still shows the *old* plan set.
3. **Build-tier credit costs are defined inconsistently in four places** (`lib/credits/credits.ts`, `lib/billing/config.ts`, `components/project-workspace.tsx`, `components/project-workspace-controls.tsx`) — a real risk if any redesign displays costs.
4. `/api/billing/overview` is polled by `app/settings/billing/page.tsx` but **no route file exists** at `app/api/billing/overview/` — billing history likely renders empty.

---

## 2. What Atai Currently Is

**CONFIRMED (from code):**

- **Product identity:** Next.js 16 App Router SaaS. Root metadata: *"Atai.ink is the AI business-building platform. Plan, build, launch, manage, and grow a digital business from an idea, a website, a URL, or a GitHub project."* (`app/layout.tsx`)
- **Core loop:** create project (3 modes) → AI analysis → plan generation (`specification_ready` → `plan_ready`) → Collaborate (plan review + AI chat) → launch → Totalum build → preview → deploy.
  - Pipelines: `lib/analysis/pipeline.ts` (website + scratch + deep-crawl), `lib/analysis/github-pipeline.ts` (clone/extend).
  - Launch: `app/api/projects/[id]/launch/route.ts` → `autoLaunchBuild()`.
- **Three starting modes:** `ProjectMode = "website" | "scratch" | "github"` (`lib/types/project.ts`); UI at `/new`, `/new/idea`, `/new/website`, `/new/github`.
- **AI Co-Founder:** per-project plan chat producing structured, never-auto-applied proposals (`app/api/projects/[id]/plan-chat/route.ts`; types in `lib/types/plan-analysis.ts`).
- **Build engine:** Totalum (`lib/integrations/totalum/service.ts` — `launchProject`, `getAgentStatus`, `getFullConversation`, `getDeploymentStatus`). Crawling: Firecrawl (`lib/integrations/firecrawl/service.ts`), with `firecrawl_cache` collection (`lib/db/collections.ts`).
- **Credits economy:** two credit types (subscription → permanent consumption order), reserve → reconcile → refund discipline, idempotent ledger (`lib/credits/credits.ts`, `lib/billing/config.ts`, `credit_ledger` collection in `lib/db/collections.ts`).
- **Persistence:** MongoDB via `MongoStore` implementing the `DataStore` interface (`lib/store/store.ts`, `lib/store/mongo-store.ts`); 20+ collections indexed in `lib/db/collections.ts:ensureIndexes()`.
- **Auth:** custom auth — email/password (bcrypt) + Google + GitHub OAuth, hashed session tokens in `sessions` collection (`lib/auth/session.ts`, `lib/db/collections.ts`, `lib/types/db.ts:AuthProvider`).

**INFERRED:**

- The "AI team" is currently **one** co-founder persona (Collaborate chat) plus the Totalum build agent (follow-up prompts via `/api/projects/[id]/agent`). No distinct named agent roles exist in the UI.

**UNKNOWN / NOT IMPLEMENTED (searched, absent):**

- Atai SDK (`@atai/sdk`), `app/api/atai/` router, `atai_proj_` API keys — pivot spec Requirement 8. `grep atai_proj_` → 0 matches.
- Business_Overview_Tab, "Customer Data" tab rename, Domain_SEO_Panel — pivot spec Requirement 9. Database page is still titled "Database" (`app/project/[projectId]/database/page.tsx`).
- Pivot-spec 4-step Onboarding_Dialog (roles, destination routing, video step) — implemented onboarding is instead the "First Mission" overlay (`components/onboarding/first-mission.tsx`).
- Generated-app health checks against `developmentUrl` for dashboard metrics (Requirement 9.3) — only a user-triggered screenshot capture exists (`/api/projects/[id]/capture-preview`).

---

## 3. Target User As Implemented

**CONFIRMED via copy and flows:**

- **Non-technical founders:** idea form says *"No technical knowledge needed. Tell us what problem you're solving and who it's for"* (`app/new/idea/page.tsx`); founder form fields are Problem / Target audience / Solution / Business model (`components/founder-idea-form.tsx`).
- **Builders building on competitors:** website mode is labeled "Competitor build" in project lists (`app/projects/page.tsx:modeLabel`); `/new` card: *"Mirror a website — point us at a live site… turn it into an editable application plan"*; projects empty state CTA "Build on a competitor" (`app/projects/page.tsx`).
- **Developers:** GitHub clone/extend mode (`app/new/github/page.tsx`), source viewer (`/project/[id]/source`), env manager (`/project/[id]/env`), repo artifacts (`/readme`, `/tree`, `/repo-code`).
- **Growth loops target founders referring founders:** dashboard card *"Help other founders — earn credits… up to 2,000 Atai Credits"* (`app/dashboard/page.tsx`); referral dashboard shows "Up to 2,000 Credits per successful referral" (`components/referral-dashboard.tsx:158,245`).

**Primary outcome as implemented:** a deployed full-stack application at a live URL, managed from a per-project workspace (preview iframe, database browser, deploy history, GitHub sync).

---

## 4. Complete Route Map

### 4.1 Public / marketing
| Route | Purpose | Source |
|---|---|---|
| `/` | Landing page (hero, trust, lifecycle, start/plan/build/infra/manage/grow sections) | `app/page.tsx` → `components/landing/landing-page.tsx` |
| `/pricing` | Plans, permanent credit packs, build tiers, hosting comparison | `app/pricing/page.tsx` |
| `/about` `/privacy` `/terms` `/refund-policy` `/database-terms` `/docs` `/resources` `/modes-comparison` | Legal / marketing / help | `app/*` directories |

### 4.2 Auth
| Route | Purpose | Source |
|---|---|---|
| `/login` | Sign-in; "Welcome back, founder. Your team is ready." | `app/login/page.tsx` |
| `/register` | Signup | `app/register/page.tsx` |
| `/forgot-password` `/verify-email` `/confirm-email-change` | Recovery / verification | `app/*` |

### 4.3 Authenticated core
| Route | Purpose | Entry From | Primary Action | Next Step |
|---|---|---|---|---|
| `/dashboard` | Home: greeting, recent projects, checklist, promos, First Mission overlay for new users | login, landing "Open dashboard" | Navigate / start mission | `/project/[id]`, `/projects`, `/new/*`, `/explore`, `/referrals` |
| `/start` | Auto-continuation: consumes pending start intent → creates project → redirects | First Mission / landing CTAs | Automatic | `/project/[id]/collaborate` |
| `/new` | Mode picker (website/idea + GitHub banner) | dashboard, `/projects` | Choose mode | `/new/{idea,website,github}` |
| `/new/idea` | Founder form (5 fields + business model select) | `/new`, StartStrip | Submit idea | project created → collaborate |
| `/new/website` | URL input + crawl mode + pipeline mode | `/new` | Submit URL | project created |
| `/new/github` | Repo URL + clone/extend | `/new` | Submit repo | project created |
| `/projects` | All projects: filter tabs (All/Planning/Building/Live/Failed), search, sort, grid/list, delete | dashboard "All projects" | Open/manage | `/project/[id]` or collaborate |
| `/project/[id]` | Workspace: stepper, state badge, plan CTA, preview, publish, GitHub, activity, assets, controls | dashboard/projects | Monitor & act | collaborate/edit/source/db/deploy |
| `/project/[id]/collaborate` | 60/40 plan + AI Co-Founder chat; launch button | auto-redirect when `plan_ready`, cards, checklist | Review/refine plan; Submit Plan & Start Building | `/project/[id]` (building) |
| `/project/[id]/plan` | Read-only full plan (understanding, spec, conversation, build summary) | ProjectActions "View plan" | Read | workspace |
| `/project/[id]/edit` | Edit workspace (conversation + plan editing) | ProjectActions "Edit plan", build-failed CTA | Edit/fix | workspace |
| `/project/[id]/source` | Source code viewer (built only) | ProjectActions | Browse code | database |
| `/project/[id]/database`, `/database/[table]` | Infrastructure manager + table/record browser | ProjectActions | Manage data | edit |
| `/project/[id]/env` | Environment variables (secret keys) | BuildSummary card, ProjectActions | Add secrets | workspace |
| `/project/[id]/readme` `/tree` `/repo-code` | GitHub-mode artifacts | workspace (github mode) | View | — |
| `/project/[id]/runtime` | Runtime overview (provisioning, usage, keys) | ProjectActions "Runtime" | Inspect | — |
| `/explore` | Public gallery: like, follow, fork | header | Discover/fork | fork → project |
| `/referrals` | Referral link, milestones, rewards | dashboard card, account menu | Copy link | — |
| `/settings`, `/settings/profile`, `/settings/security`, `/settings/appearance`, `/settings/billing` | Account + billing (plans, packs, credit history, cancel) | account menu | Manage account | — |
| `/billing/top-up` | **Redirect only** → `/settings/billing` | CreditMeter "Top up" | — | settings/billing |
| `/admin/*` (20 pages) | Users, payments, ledger, subscriptions, runtime, referrals, webhooks… | account menu (admin only) | Administer | — |

### 4.4 API namespaces (`app/api/`)
`admin`, `auth`, `billing` (checkout, top-up, subscription, webhook — **no `overview` route, see §25**), `credit-costs`, `credits`, `explore`, `github`, `health`, `internal`, `me`, `projects` (**44 subroutes** under `app/api/projects/[id]/` incl. `activity`, `agent`, `plan-chat`, `analyze-plan`, `auto-complete`, `build`, `deploy`, `launch`, `status`, `fork`, `like`, `database/*`, `runtime/*`, `source`, `versions`, `visibility`, …), `public`, `referrals`, `runtime`, `start`, `user`, `users`.

### 4.5 Not implemented (explicitly)
Dedicated `/onboarding` route, team/members UI, notifications page/feed, integrations page, per-project settings page (settings live in `/project/[id]/edit` + `ProjectPreferencesDialog`).

---

## 5. Current Dashboard Anatomy

Source: `app/dashboard/page.tsx` (client component; auth via `useSession`, redirect to `/login?next=%2Fdashboard` when unauthenticated).

### 5.1 Header (`components/app-header.tsx`)
- **BrandLogo** (text mark) — `components/brand-logo.tsx`.
- **Explore** nav link (compass icon); desktop `hidden sm:flex`, compact mobile variant.
- Right cluster: **ThemeToggle** (5-theme dropdown — `components/theme-toggle.tsx`), **CreditMeter** (`components/credit-meter.tsx`: available/total, reserved bar, low-balance "Running low? Top up" → `/billing/top-up` → redirects to `/settings/billing`), **AccountMenu** (`components/account-menu.tsx`: avatar dropdown → Account, Refer & Earn, Admin panel (admin only), Settings, Appearance, Sign out; sign-out wipes Zustand store + SWR cache then hard-reloads).
- **VerifyEmailBanner** under the header when `!emailVerified` (`components/verify-email-banner.tsx`), with an *honest* resend (reports SMTP unconfigured instead of pretending).
- **No search, no notifications, no project switcher, no sidebar.**

### 5.2 First Mission overlay (`components/onboarding/first-mission.tsx`)
- Full-screen `fixed inset-0 z-50` overlay.
- Visibility logic: `resolveFirstMissionSurface()` in `lib/onboarding/state.ts` — shows when session ready AND `projects.length === 0` AND no `onboarding.completedAt` AND no pending start intent; renders "empty-cta" variant if previously dismissed; forceable via `/dashboard?mission=1`.
- Phase 1 "vision": textarea with live mode auto-detection (`detectStartMode`, `lib/start/detect-input.ts`), mode chips (Idea / Mirror / URL / GitHub), hint text, 4 example lines.
- Phase 2 "context": only for short/vague inputs (`needsFollowUp`) — asks "Who are you building this for?" (or mode-specific follow-ups) and shows capability chips (Product direction, Business model, Technical plan, Build requirements, Launch strategy).
- Draft autosaves to `sessionStorage["atai:first-mission-draft:{userId}"]`.
- Footer: "I'll do this later" (records `onboarding.dismissedAt` via `lib/onboarding/activate.ts` → PATCH `/api/user/onboarding` path in `lib/onboarding/activate.ts`) and "Let's get to work" → saves `PendingStart` (localStorage via `lib/auth/client-intent.ts`) → `/start`.

### 5.3 Main content (top → bottom)
1. **Greeting block** — eyebrow `DASHBOARD` (mono, uppercase, tracking), H1 `Good to see you, {firstName}.` (4xl→6xl), subcopy *"You bring the vision. Atai helps you shape the plan, build the product, and go live."*, right-aligned "All projects →" button (`/projects`).
2. **ActivationEmpty** — only when no projects AND onboarding dismissed AND not completed. "What are you building?" card, CTA "Start with Atai" → `/dashboard?mission=1` (`components/onboarding/activation-empty.tsx`).
3. **StartStrip** — only when projects exist. "New project" label + pill links: Idea `/new/idea`, Reference `/new/website`, GitHub `/new/github` (`components/onboarding/start-strip.tsx`).
4. **OnboardingChecklist** — only when projects exist and not all steps done. "Your first build" for the **most recently updated project**; steps: *Tell Atai what you're building* (always ✓), *Shape the plan* (PLAN_STATES), *Build the product* (BUILD_STATES), *Go live* (`deployed`) — `components/onboarding-checklist.tsx`; rows link to collaborate/workspace. **Single project only; no cross-project rollup.**
5. **ProjectList** — "Recent projects" + count + "View all"; grid of up to 4 `ProjectCard`s (`components/project-card.tsx`: thumbnail from `understanding.screenshots[0]`, host/title, `StateBadge`, relative time, hover delete → confirm dialog); "+N more projects…" overflow row. Loading: 4 `Skeleton`s. Error: red mono message. Empty: dashed panel ("No projects yet…") with **legacy mirror copy** ("Enter a URL above to create your first mirror") that contradicts the current product framing.
6. **Explore promo** — compass icon, "See what other founders are building… fork a project straight into your workspace", CTA "Browse the library" → `/explore`. **Static content** (no live stats).
7. **Referral promo** — emerald card, "Help other founders — earn credits… up to 2,000 Atai Credits", CTA "Get your referral link" → `/referrals`. **Static content.**

### 5.4 Absent from the dashboard
No aggregated business state, no cross-project activity feed, no "what Atai did while you were away", no usage/credits snapshot (beyond header chip), no milestone/health rollup beyond per-card badges and the single-project checklist, no direct jump into the active build.

---

## 6. Dashboard Component Inventory

| Component | Location | Purpose | Data | Interaction | Status |
|---|---|---|---|---|---|
| `AppHeader` | `components/app-header.tsx` | Global chrome | session | nav, theme, account | Implemented |
| `BrandLogo` / `BrandMark` | `components/brand-logo.tsx` | Identity | static | link | Implemented |
| `ThemeToggle` | `components/theme-toggle.tsx` | 5-theme switch | localStorage + `/api/user/theme` | dropdown | Implemented |
| `CreditMeter` | `components/credit-meter.tsx` | Balance chip | `/api/me` via `useSession` | tooltip, top-up link | Implemented |
| `AccountMenu` | `components/account-menu.tsx` | Account actions | session | dropdown; store wipe on logout | Implemented |
| `VerifyEmailBanner` | `components/verify-email-banner.tsx` | Verification nudge | session | resend → toasts | Implemented |
| `FirstMission` | `components/onboarding/first-mission.tsx` | New-user capture | session, projects, sessionStorage | 2-phase form | Implemented |
| `ActivationEmpty` | `components/onboarding/activation-empty.tsx` | Re-engage dismissed users | static + query param | CTA → mission | Implemented |
| `StartStrip` | `components/onboarding/start-strip.tsx` | Quick create | static links | links | Implemented |
| `OnboardingChecklist` | `components/onboarding-checklist.tsx` | First-build progress | newest project state | 4 step links | Implemented |
| `ProjectList` | `components/project-list.tsx` | Recent projects (4) | `useProjects` → GET `/api/projects` | open/delete/see-all | Implemented |
| `ProjectCard` | `components/project-card.tsx` | Project tile | `ProjectSummary` | open, delete dialog | Implemented |
| `StateBadge` (live) | `components/state-badge-live.tsx` | Lifecycle chip | SWR `/api/projects/[id]` (15s idle / 3s active) | none | Implemented |
| `Skeleton` | `components/ui/skeleton.tsx` | Loading | — | — | Implemented |

**Workspace-level components** (relevant context for any dashboard redesign): `ProjectWorkspace` (orchestrator, ~1,161 lines in `components/project-workspace.tsx`), `ProjectStepper`, `BuildLoading`, `PublishMenu`, `DeploymentHistory`, `ProjectActivity`, `ProjectAssets`, `ProjectWorkspaceControls`, `ProjectVisibilityToggle`, `ProjectGitHubIntegration`, and inline `PlanReadyCTA`, `ReadyToBuildCTA`, `DevPreview` (viewport-switchable iframe with drag-resize), `BuildSummaryCard`, `CapturePreviewButton`.

---

## 7. Dashboard Data Flow

| Dashboard Element | Component | Data Source | API/Action | Database Model | Real/Mock |
|---|---|---|---|---|---|
| Greeting name | `app/dashboard/page.tsx` | `useSession().session.user.name` | GET `/api/me` (`app/api/me/route.ts`) | `users` | **REAL** |
| Credit meter | `components/credit-meter.tsx` | `session.credits.{balance,reserved,available}` | GET `/api/me` → `getBalance()` | `users.subscriptionCredits/permanentCredits` + `creditBuckets` | **REAL** |
| Recent projects | `components/project-list.tsx` | `useProjects()` (Zustand `lib/store/client-store.ts`) | GET `/api/projects` (`app/api/projects/route.ts` → `store.listProjects`) | `projects` collection | **REAL** |
| Project thumbnail | `components/project-card.tsx` | `ProjectSummary.thumbnailUrl` | GET `/api/projects` | `projects.understanding.screenshots[0]` | **REAL** (null until crawl/capture) |
| State badge | `components/state-badge-live.tsx` | SWR poll `/api/projects/[id]` | GET `/api/projects/[id]` | `projects.state` | **REAL** |
| Checklist steps | `components/onboarding-checklist.tsx` | derived from newest project `state` | client derivation | `projects.state` | **REAL (derived)** |
| Mission visibility | `lib/onboarding/state.ts` | session onboarding fields + projects count | GET `/api/me`, `/api/projects` | `users.onboarding` | **REAL** |
| Explore promo | `app/dashboard/page.tsx` | hardcoded JSX | — | — | **STATIC CONTENT** |
| Referral promo | `app/dashboard/page.tsx` | hardcoded JSX (reward figure duplicated in `components/referral-dashboard.tsx`) | — | — | **STATIC CONTENT** |
| Session caching | `lib/store/client-store.ts` | Zustand store; `/api/me` bg-refresh every 120 s; projects fetched once, invalidated on create/delete | — | — | REAL |

**Note:** `/api/me` always returns `reserved: 0` ("reserve transactions already debit the balance" — `app/api/me/route.ts` comment), while `CreditMeter` still renders a "reserved" bar and tooltip. Real data, partially vestigial UI.

---

## 8. Project Data Model

Source of truth: `lib/types/project.ts` → `MirrorProject` (aliased as `Project`), persisted in MongoDB `projects` collection (`lib/db/collections.ts:projectsCol()`).

| Field | Type | Purpose |
|---|---|---|
| `id`, `userId` | string | Ownership (`projects` index `userId, updatedAt`) |
| `mode` | `"website" \| "scratch" \| "github"` | Starting mode |
| `name` | string | Display name |
| `state` | `ProjectState` (14 values, below) | Persisted lifecycle |
| `sourceUrl`, `crawlMode` (`relevant`/`deep`), `pipelineMode` (`legacy`/`heavy`) | | Website-mode inputs |
| `idea` | string | Idea-mode input (composed from Founder Form fields) |
| `understanding` | `ProjectUnderstanding` | Observed/inferred/suggested site analysis incl. `screenshots[]` (`lib/types/understanding.ts`) |
| `specification` | `ApplicationSpecification` | The plan: business layer (vision, problem, solution, valueProposition, businessModel, revenueModel, marketPositioning, marketingPlan, launchPlan, growthPlan) + product layer (targetUsers, userRoles, coreFlows, suggestedFeatures, dataEntities, auth requirements) + `complexity` (`lib/types/specification.ts`) |
| `totalumProjectId`, `developmentUrl` | | Build linkage + preview |
| `events[]` | `ProjectEvent[]` | Activity log (level/stage/message) |
| `conversation[]` | `ConversationMessage[]` | User/agent/plan-chat messages |
| `deployment`, `deploymentHistory[]` | | Deploy records (`productionUrl`, `customDomain`, `creditsCharged`) |
| `buildSummary` | | AI's post-build summary incl. `secretKeysNeeded` (from Totalum `realtimeConversation` "finished" messages) |
| `infrastructure` | `InfrastructureSubscription` | Per-project infra plan/usage/quotas |
| `preferences` | `ProjectPreferences` | appName, stackType, databaseChoice, authProviders, additionalNotes |
| `planAnalysis` | `PlanAnalysis` | Cached AI plan review (findings, proposals, nextBestAction, creditsCharged) |
| `planUpdateNotes[]` | | Accepted plan-change decisions fed back into AI context |
| `githubReadme`, `githubFileTree`, `githubZipUrl` | | GitHub-mode artifacts |
| `visibility` | `"private" \| "public"` | Public requires deployed; gates Collaborate access |
| `specSanitized` | | Plan auto-adjusted to supported stack |
| `runtimeProvisioning` | `RuntimeProvisioningMap` | Phase-8 runtime credential metadata (never secrets) |

**ProjectState lifecycle** (`lib/types/project.ts`): `created → analyzing → analysis_complete → specification_ready → plan_ready → awaiting_build_confirmation → building → build_complete → ready → deploying → deployed`, plus failures `build_failed`, `deployment_failed`, and `pending_plan`. Labels in `STATE_LABELS`.

**Related collections** (`lib/db/collections.ts`): `users`, `sessions`, `verification_tokens`, `rate_limits`, `build_runs`, `project_assets`, `provider_usage`, `topups`, `publish_events`, `referrals`, `doc_feedback`, `webhook_events`, `credit_ledger`, `build_authorizations`, `payment_records`, `subscription_records`, `planning_runs` (90-day TTL), `firecrawl_cache` (7-day TTL), `project_likes`, `user_follows`, `project_forks`, `project_github`.

**What a project does NOT have:** tasks, milestones, collaborators/team, documents, notifications, custom domains (domain lives inside deployment records), growth analytics.

---

## 9. End-to-End User Journey

```
Visitor (landing /, /pricing)
  → Auth (/register, /login; Google OAuth supported)
  → First Mission overlay on /dashboard  [trigger: no projects, not onboarded]
  → /start  [auto-creates project from PendingStart; 3-step status screen]
  → /project/[id]/collaborate  [60/40 plan + chat]
  → "Submit Plan & Start Building" → POST /launch
  → /project/[id]  [building: BuildLoading, stepper, toasts]
  → ready  [DevPreview iframe, BuildSummary, Publish, GitHub]
  → deployed  [live-URL banner, DeploymentHistory, visibility toggle]
```

Transition-by-transition:

1. **Landing → Auth:** CTA is `/register` for guests, `/dashboard` for sessions (`components/landing/landing-page.tsx:useSession`). CONFIRMED.
2. **Auth → Dashboard:** post-login redirect honors `next` param (`app/dashboard/page.tsx` redirect logic mirrors it). CONFIRMED.
3. **Dashboard → First Mission:** automatic overlay for new users; skip records `dismissedAt` and shows ActivationEmpty instead. CONFIRMED.
4. **Mission → /start → project created:** `PendingStart` carries composed prompt, mode, `pipelineMode: "heavy"` default (`components/onboarding/first-mission.tsx:goToCreate`); `/start` calls `createProjectFromPending` → POST `/api/projects` with `skipAnalysis: true` and an idempotency key (`lib/projects/continue-start.ts`), then `recordOnboardingActivation`, then replaces to Collaborate. Context is fully carried. CONFIRMED.
5. **Analysis → plan_ready:** pipelines set `state: "plan_ready"` and stop (no auto-build, no credit charge) — `lib/analysis/pipeline.ts:114,214,269,424`, `lib/analysis/github-pipeline.ts:203,300`. CONFIRMED.
6. **plan_ready → Collaborate:** workspace auto-redirects after ~1.8 s with a countdown CTA (`components/project-workspace.tsx:PlanReadyCTA` + `autoRedirectedRef` effect). Interruption risk: redirect can yank a user mid-scroll. CONFIRMED.
7. **Collaborate → launch:** only valid from `plan_ready` (409 otherwise) — `app/api/projects/[id]/launch/route.ts`; credits reserved inside `autoLaunchBuild` (`lib/analysis/pipeline.ts:22-100`). CONFIRMED.
8. **Building → ready/build_failed:** `/api/projects/[id]/status` polls Totalum server-side, reconciles credits, captures BuildSummary (`app/api/projects/[id]/status/route.ts`). CONFIRMED.
9. **ready → deployed:** `PublishMenu` → POST `/deploy` (500 credits per pricing copy) with subdomain/custom-domain steps (`components/publish-menu.tsx`). CONFIRMED.

**Friction points observed (documented, not fixed):** auto-redirect can disorient; `/start` failure screen offers retry/open-form (good) but the pending intent is *taken* only on success (good); First Mission "Mirror" chip wording differs from `/new` "Mirror a website" (minor inconsistency).

---

## 10. First-Time User Experience

Pretending to be a brand-new user, from code:

1. **First screen:** landing page hero → "Get started free" → `/register`.
2. **After signup:** `/dashboard`; the **First Mission** overlay covers the dashboard completely. What they must understand: Atai wants their vision in plain words. What they enter: 1–2 sentences (or a URL/repo — auto-detected).
3. **After submitting:** optional follow-up ("Who are you building this for?" for short ideas) → `/start` shows a 3-step status ("Creating your Atai workspace" → "Bringing your idea into context" → "Ready to collaborate") while the project is created server-side.
4. **What gets created:** a `scratch`/`website`/`github` project with the composed idea, `pipelineMode: "heavy"` by default, **no credits charged** (`skipAnalysis: true` defers analysis costs to pipeline run).
5. **Landing in Collaborate:** left plan nav with completeness %, right AI chat intro "I know your idea. Let's make it stronger." + 5 quick actions ("What should I improve?", "Find gaps", "Challenge my assumptions", "Improve my business model", "What's next?").
6. **First recommended action:** either chat quick actions or the "Analyze My Plan" button in the insights panel (charges `ai_collaboration` credits — `app/api/projects/[id]/analyze-plan`); the plan must reach `plan_ready` before "Submit Plan & Start Building" enables.
7. **Confusion risks (CONFIRMED by code, not speculation):**
   - Two overlapping AI surfaces: Collaborate chat vs. workspace "Workspace controls → Continue building" prompt (`components/project-workspace-controls.tsx`) — different costs, different timing; a new user can't know which to use when.
   - Credit costs shown as raw numbers (e.g. "50,000 credits") with no plan context (Requirement: hide costs from non-admins — see pivot spec AC 4.16/4.17, not implemented).
   - Email verification gate: welcome credits (500) require verification; `CreditMeter` shows "Verify email" state.
8. **Abandonment risks:** the gap between "workspace ready" and "build launched" requires understanding plan completeness %; a user who dismisses the mission sees a static card, not a resumable draft (draft only persists in `sessionStorage`).

---

## 11. Returning User Experience

A founder who created a business yesterday and returns today sees (CONFIRMED, in order): header with credit chip → greeting → StartStrip → OnboardingChecklist (only for the **newest** project, and hidden entirely once `deployed`) → 4 project cards → 2 static promos.

What the current implementation supports vs. the "returning founder" questions:

- *"What was I doing?"* — Partially: checklist reflects newest project's phase; card badges show state. No narrative ("Your build finished at 09:12").
- *"What did Atai do while away?"* — **No.** Activity exists per project (`/api/projects/[id]/activity`) but is never surfaced on the dashboard.
- *"Can I resume?"* — Yes for plan_ready (checklist links to Collaborate; `/projects` shows "N plans ready for your review" badge). Not for building/failed states.
- *"Current milestone?"* — Only via the per-project stepper inside the workspace, not on the dashboard.
- *"Blockers?"* — Build failures appear as a badge on cards (`build_failed` state badge); the dashboard has no failure callout.
- *"Ask my AI team?"* — Not from the dashboard; requires entering a project → Collaborate.
- *"Jump to active work?"* — Manually via cards; no "continue where you left off" prioritization (ProjectList is `updatedAt` order but caps at 4 and the checklist uses a separate "most recently updated" pick, which can disagree with what the user considers active).

---

## 12. AI Team / Agent Architecture

**CONFIRMED:**

- **AI Co-Founder (planning):** `POST /api/projects/[id]/plan-chat` (`app/api/projects/[id]/plan-chat/route.ts`). Receives `{ message, activeSection }`; builds context via `buildCollaborateContext` + `COFOUNDER_CHAT_SYSTEM` (`lib/analysis/cofounder.ts`); returns `{ reply, proposal?, decisions }`. Charges credits (`chargeChatCredits` / `refundCollaboration` in `lib/analysis/collaborate-credits.ts`). **Never mutates the plan** — proposals persist only via `PATCH /api/projects/[id]` with `sectionUpdate` (+ `acceptedProposal.id`); rejections persist via `dismissProposalId`.
- **Plan analysis:** `POST /api/projects/[id]/analyze-plan` produces a validated `PlanAnalysis` (findings by severity, proposals, `nextBestAction`, `healthPercent`, `creditsCharged`) cached on `project.planAnalysis` (`lib/types/plan-analysis.ts`). Proposals can be accepted/rejected inline (AnalysisProposalRow) with durable dismissal.
- **Auto-complete:** `POST /api/projects/[id]/auto-complete` — the co-founder drafts all missing plan sections sequentially with per-section cost accounting, pause-on-out-of-credits, stop, undo, and "apply existing suggestions first" phase (UI: `AutoCompleteRunView` in `app/project/[projectId]/collaborate/collaborate-client.tsx`).
- **Build agent (execution):** Totalum agent. Follow-up prompts via `POST /api/projects/[id]/agent` (rate-limited 20/h; `claimBuildSlot` prevents concurrent runs; same reserve→launch→refund discipline) — `app/api/projects/[id]/agent/route.ts`. Full conversation retrievable at `/agent/full-conversation`; stoppable at `/agent/stop`.
- **Context awareness:** the co-founder knows the project's specification, conversation, and active section; build prompts are generated from spec + understanding + preferences (`buildInitialBuildPrompt`, `lib/analysis/prompt-builder.ts`).
- **Storage:** all exchanges append to `projects.conversation` (`role`, `content`, `at`); build events to `projects.events`.

**INFERRED:** agent "roles" are implicit (planner/co-founder vs. builder); there is no multi-agent UI, no agent list, no per-agent identity. Recommendations CAN be accepted (proposal workflow) and DO connect to execution (accepted spec changes feed the build prompt).

---

## 13. Planning & Collaboration Architecture

- **Collaborate layout:** server-enforced access (`app/project/[projectId]/collaborate/page.tsx`): private → owner only; public → viewable, chat owner-only. Fixed-viewport app shell (`h-dvh`), header slot `#collab-header-actions` for the portal-mounted auto-complete button.
- **Left panel (plan):** section nav grouped Foundation/Product/Business/Market (`PLAN_SECTIONS` in `lib/analysis/plan-sections.ts`), per-section status (complete/needs_work/missing via `sectionStatus`, placeholder detection via `isPlaceholderValue`), completeness % (`computePlanHealth`), AI-finding count badges.
- **Section editing:** inline editor with dirty-draft protection (confirm-discard dialog), 8,000-char limit, save via validated PATCH; missing sections offer "Work on this with AI" vs. "Write it myself".
- **Right panel (chat + insights):** chat with proposals (current vs. suggested values, "Why", dependency hints `SECTION_DEPENDENCIES`), insights (per-group progress bars, next-best-action with "Work on this", findings by severity, analysis proposals), launch button pinned when `plan_ready` ("Credits will be reserved when the build starts").
- **Plan read-only view:** `/project/[id]/plan` renders understanding + spec + assistant conversation + build summary in cards; empty state "No plan yet" (`app/project/[projectId]/plan/page.tsx`).

---

## 14. Build Pipeline

**CONFIRMED flow (`lib/analysis/pipeline.ts`):**

1. Project created via `createUserProject` (`lib/projects/create-project.ts`) — mode-specific input validation, idempotency key reuse (`reused` response).
2. Pipeline runs: Firecrawl crawl (normal or deep; cached in `firecrawl_cache`) → `analyzeWebsite` → understanding; or idea → `generateSpecificationFromIdea`. GitHub: README/file-tree/zip ingestion (`lib/analysis/github-pipeline.ts`).
3. Specification generated (`generateSpecificationFromUnderstanding`); sanitization to supported stack may set `specSanitized` (warning surfaced in workspace UI).
4. `state → plan_ready`. **No credits reserved.** (`pipeline.ts:114,214,269,424`)
5. Launch (`app/api/projects/[id]/launch/route.ts`): 409 unless `plan_ready` → `awaiting_build_confirmation` → `autoLaunchBuild()` fire-and-forget: tier cost via `getTierCost(tier, pipelineMode)` (`lib/credits/credits.ts`), `hasSufficientCredits`, `createBuildRun`, atomic `claimBuildSlot`, `reserveCredits`, Totalum `launchProject` with `mirror-{name}-{shortId}` project name and infra cap from `getInfrastructurePlan("testing")`.
6. Polling (`app/api/projects/[id]/status/route.ts`): server-side Totalum sync → state transitions → credit reconciliation/refunds → BuildSummary capture (first "finished" message, `secretKeysNeeded`) → auto GitHub push when connected (`pushProjectToGitHub`) → runtime provisioning (`ensureRuntimeProvisioned`) → referral milestone checks.
7. Terminal: `ready` (dev URL) → optional `deploy` (500 credits; subdomain or custom domain with DNS records) → `deployed`.

**Cost model reality-check (duplication, see §25):**
- `lib/credits/credits.ts`: `TIER_COSTS = { simple: 25_000, medium: 50_000, complex: 75_000 }`; `HEAVY_TIER_COSTS = { 50_000 / 75_000 / 100_000 }`.
- `lib/billing/config.ts:BUILD_TIERS` = `{ 50_000 / 75_000 / 100_000 }` (no heavy/legacy split).
- `components/project-workspace.tsx:ReadyToBuildCTA` hardcodes `{ 25_000 / 50_000 / 75_000 }`.
- `components/project-workspace-controls.tsx` hardcodes the same `{ 25_000 / 50_000 / 75_000 }` for the *build* button but uses `costs.Atai.followup.reserve` for follow-ups.
→ The two client components **understate or mismatch** server costs depending on pipeline mode. Follow-up pricing page says "Simple/Medium/Complex" = 50k/75k/100k (`app/pricing/page.tsx` reads `BUILD_TIERS`).

---

## 15. Generated Application Flow

- **Preview:** `DevPreview` inline component — browser-chrome iframe of `developmentUrl` with desktop/tablet/mobile viewport toggles, drag-to-resize (200–1200 px), sandboxed iframe, "Open ↗". CONFIRMED (`components/project-workspace.tsx`).
- **Thumbnail:** auto from crawl screenshots; else user-triggered "📸 Capture preview" → POST `/capture-preview` (`lib/screenshots/capture-app-preview.ts`). CONFIRMED.
- **Build summary:** amber "Important — Your app is ready" card; markdown-rendered agent message; API-keys-needed panel listing each secret with provided/missing dots and deep-link to `/env`. CONFIRMED (`BuildSummaryCard`).
- **Source & export:** `/source` viewer, `/export` route, version history (`/versions`, `/version-diff`), code recovery (`/recover`). CONFIRMED (routes + `app/api/projects/[id]/*`).
- **GitHub:** push/sync via `ProjectGitHubIntegration` + `/github` route; auto-push on build completion when connected (`status/route.ts` import of `pushProjectToGitHub`). CONFIRMED.
- **Database:** `/database` + `/database/[table]` with `DatabaseProvider`, table list, record dialogs, plus `InfrastructureManager` (plan, storage, Totalum credit cap). CONFIRMED.
- **Deploy:** `PublishMenu` wizard (choose → deploying → custom-DNS → done), polls `/deploy` GET, shows production URL, custom domain status + DNS records, remove-domain flow. CONFIRMED.
- **Runtime control:** `/runtime` overview client (`components/runtime-control/overview-client.tsx`) with usage export, requests, config, keys (`app/api/projects/[id]/runtime/*`, `app/api/runtime/*`). CONFIRMED.

**NOT IMPLEMENTED:** Business overview metrics (users, revenue from Dodo, active subscriptions, health-check latency) — nothing queries the *generated app's* business data; the workspace is technical, not business-facing (pivot spec Requirement 9 unfulfilled).

---

## 16. Atai Runtime Architecture

- **Contracts:** `runtime/contracts/` (billing transaction types feed `LedgerTransactionType` union — `lib/billing/config.ts` imports `RuntimeLedgerTransactionType`); provisioning types in `lib/runtime/provisioning/types.ts`.
- **Provisioning:** per-environment records with crash-recovery claims (`claimRuntimeProvisioning`, stale-claim takeover) — `lib/store/store.ts`, `lib/runtime/provisioning`. Metadata only (status/keyId/prefix/timestamps) on the project doc; `api_keys` remains the credential source of truth.
- **Router:** `app/api/runtime/v1/*` + `app/api/runtime/keys` (runtime API keys); per-project routes `runtime/config`, `runtime/control`, `runtime/requests`, `runtime/usage` (+ CSV export). Admin views: `/admin/runtime`, `/admin/runtime/pricing`.
- Docs: `docs/RUNTIME_API_ARCHITECTURE.md`, `docs/RUNTIME_API_KEYS.md`, `docs/RUNTIME_ROUTER.md`, `docs/RUNTIME_AUTH.md` (repo docs).
- **Pivot-spec Atai SDK/API-router** (`app/api/atai/*` proxying payments/AI/email/etc. for generated apps): **NOT IMPLEMENTED**.

---

## 17. Usage / Credits / Billing

**What the user sees:**

- **Header chip** (`components/credit-meter.tsx`): "CREDITS available / total" + reserved bar (vestigial — reserved is always 0 from `/api/me`) + "Verify email" state when balance 0 & unverified + low-balance top-up link (< 1,000 available).
- **Settings → Billing** (`app/settings/billing/page.tsx`): big balance card (total split subscription/permanent), current plan card (price, credits/mo, period end, cancel-at-period-end states, `CancelSubscriptionButton`), "How credits work" 3-step explainer, plan grid (5 non-custom plans via `PlanCard`), permanent packs (`CheckoutButton` → Dodo), **credit history table** (desktop grid + mobile list, `+/-` amounts colored).
- **Pricing page** (`app/pricing/page.tsx`): hero (500 welcome credits), how-credits-work, subscription plans, permanent packs, build tiers (Simple 50k / Medium 75k / Complex 100k), hosting comparison (subdomain vs custom domain, both "500 credits"), schema.org Product markup.
- **APIs:** checkout, top-up (+ manual evidence/verify flow for non-Dodo payments), subscription cancel (+ feedback), webhook (Dodo), admin billing surfaces. **`/api/billing/overview` does not exist** although `app/settings/billing/page.tsx:51` polls it — the page guards with `?? { total: 0, subscription: 0, permanent: 0 }`, so it will silently render zero-balance/history. (Also note `app/api/credits/route.ts` exists and returns `{ balance, transactions }` — a working alternative.)

**Under the hood:** reservation + reconciliation + refunds (`lib/credits/credits.ts`, `lib/billing/build-auth.ts`, `lib/billing/credit-service.ts`); ledger `credit_ledger` with idempotency (`lib/db/collections.ts`); credit *buckets* per subscription with oldest-expiry-first consumption (`lib/types/db.ts:CreditBucket`); referral rewards (500 verify / 1,500 milestone / 2,000 headline) — note `lib/billing/config.ts` exports `REFERRAL_*` = 500/1,500 at 75k threshold while UI copy says "up to 2,000" (reconcilable: 500 + 1,500 = 2,000, but not labeled that way in code).

**Plan config drift (CONFIRMED):** `lib/billing/config.ts:SUBSCRIPTION_PLANS` = Free (0), Explorer ($12 / 50k), Starter ($79 / 300k), Business ($139 / 600k, popular), Professional ($219 / 1.4M), Enterprise ($499 / 5M+). The pivot spec (Requirement 4) defines a **different** set (Free/Explorer $20/Launch $99/Growth $399/Scale $599/Enterprise with original-vs-discounted pricing, annual toggle, limited-offer badges). **Code wins as current truth; spec is aspirational.** No `DEPRECATED_SUBSCRIPTION_PLANS` export exists.

**Limit behavior:** insufficient credits at launch → friendly event "💰 Need more credits…" and project stays `plan_ready` (`pipeline.ts`); `canAfford` gate; per-project infrastructure caps from `lib/infrastructure/plans.ts`.

---

## 18. Empty States

| Area | Empty state | CTA | Assessment |
|---|---|---|---|
| Dashboard, never onboarded | First Mission full overlay | "Let's get to work" | Strong |
| Dashboard, dismissed onboarding | `ActivationEmpty` card ("What are you building?") | "Start with Atai" → mission | Good |
| `ProjectList` empty | Dashed box: "No projects yet. Enter a URL above to create your first mirror…" | None | **Stale copy** ("mirror", "above" — no input above) |
| `/projects` empty | Rocket icon, "Your first business starts here", 3 mode CTAs | Idea / Competitor / GitHub | Strong |
| `/projects` no filter match | "No matches found" + "Clear filters" | Clear filters | Good |
| Collaborate chat empty | Intro card + 5 quick actions | Send prompt | Strong |
| Missing plan section | "Not defined yet." + hint + "Work on this with AI" / "Write it myself" | Both | Strong |
| Insights no analysis | "No analysis yet…" + "Analyze My Plan" | Analyze | Good |
| Next-best-action unset | "Run an analysis and I'll point to the most valuable next step." | — | Adequate |
| Activity empty | Neutral placeholder after load (`components/project-activity.tsx`) | — | Adequate |
| Env page, not built | "Project not built yet" panel | Back to workspace | Good |
| `/plan` no data | "No plan yet" + explanation | Back | Good |
| `/readme` `/tree` `/repo-code` | `notFound()` when artifact absent | — | Silent 404 (harsh) |
| Credit history | "No transactions yet." | — | Adequate |
| Deployment history | Section hidden entirely when `deploymentHistory.length === 0` | — | Hidden-not-empty |
| Explore | Gallery grid; page-level empty handled via `total` | — | Implemented |

**Missing empty states:** no dashboard-level "all builds done / nothing needs you" state; no notifications area (doesn't exist); no integrations empty state (page doesn't exist).

---

## 19. Loading / Error / Success States

**Loading**
- Dashboard: header-only shell while session loads (`app/dashboard/page.tsx` early return), 4 skeleton cards for projects (`components/project-list.tsx`).
- Workspace: SSR `initialState` for instant first paint, then SWR (`ProjectWorkspace`); poll cadence 10 s active / 60 s idle (dedup 5 s); `BuildLoading` with rotating encouragements, fun facts, agent message ticker, elapsed timer, 3 s `/status` poll, optimistic success/failure flip, auto-redirect on success.
- Collaborate: "Your AI co-founder is thinking…" bouncing-dots bubble; section save shows "Saving…".
- Buttons: spinners on build/deploy/capture ("Starting…", "Capturing…").

**Errors**
- API envelope `{ ok: false, error: { code, message } }` unwrapped in `lib/client/api.ts` → thrown `Error` with `code`.
- Build failed: prominent destructive panel with "Retry build" (POST `/build`) + "Edit project settings"; deployment failed analog with retry.
- Chat error inline (`role="alert"`); launch error inline above button; form errors inline (Founder Form validation).
- Toasts: workspace uses **react-hot-toast** (`components/project-workspace.tsx` — custom dark styles keyed by event level); the rest of the app uses **sonner** (20+ files) mounted via `components/ui/sonner.tsx` in the root layout. Two notification systems coexist (risk, §25).
- Status endpoint failures: SWR `onErrorRetry` capped at 5 attempts / 5 s (`components/build-loading.tsx`).
- Auth failures: client redirect to `/login?next=…`; server pages `redirect()`; Collaborate public/private handled.

**Success**
- Plan ready: animated `PlanReadyCTA` banner + countdown redirect; `plan_ready` cards on `/projects` ("✨ Plan ready — review before building") route straight to Collaborate.
- Build complete: BuildSummary card (credentials/secrets), DevPreview appears, toast "🎉"-style events from the event stream.
- Deployed: green "🚀 Your app is live" banner with production URL + "Open live site".
- Project creation: `/start` step 3 "Ready to collaborate" then redirect.
- Credit refunds/reconciliations logged as events (visible in Activity), not toasts.

---

## 20. Responsive Behavior

Documented from Tailwind classes (no runtime viewport testing performed — static inspection):

- **No sidebar anywhere** — the app uses a top header (`AppHeader`) + centered `max-w-7xl` (dashboard/workspace/projects) or `max-w-5xl` (header inner, settings) containers. The header itself uses `max-w-5xl` while content uses `max-w-7xl` — slight visual misalignment between header and content edges (CONFIRMED in `components/app-header.tsx` vs `app/dashboard/page.tsx`).
- Header: nav link `hidden sm:flex` with a compact mobile duplicate; Explore link adapts rather than hiding.
- Dashboard grid: `sm:grid-cols-2 lg:grid-cols-4` (ProjectList); `/projects`: `sm:2 / lg:3 / xl:4`, toolbar wraps `flex-col sm:flex-row`, list-row hides state/time on small screens.
- Workspace: `grid lg:grid-cols-[0.65fr_1.35fr]`, stepper `lg:sticky lg:top-24`; activity/assets 2-col `md:grid-cols-2`.
- Collaborate: plan/chat split is a client-side layout (60/40 per spec) with internal scrolling panels; mobile collapse handled inside `CollaborateClient` (`collapsedOnMobile` prop on PlanNav).
- Billing: desktop table vs. mobile stacked list for credit history; plan grid `xl:grid-cols-5`.
- Project actions: `flex-wrap` chip rows throughout.
- No `<table>`-heavy screens in the founder-facing app (admin excluded); overflow risk mainly in long URLs (mitigated with `truncate`).

---

## 21. Design System

**Typography** (`app/layout.tsx`, `app/globals.css`): Plus Jakarta Sans (`--font-jakarta`) as sans; Geist Mono for eyebrows/labels/numbers (`font-mono` used heavily for section labels like `DASHBOARD`, `Recent projects`, credits, timestamps). Scale: hero 6xl/5xl, page titles 4xl, section 2xl, card titles `text-sm font-semibold`, meta 10–11px mono uppercase with wide tracking. Weights 400–700 + `font-black` in onboarding.

**Color tokens** (`app/globals.css`, OKLCH):
- Light: bg `oklch(0.99 0 0)`, fg `0.145`, card white, border `0.9`, **primary `oklch(0.64 0.17 42)` (warm orange)**, success green `0.56 0.13 152`, destructive red `0.58 0.19 25`.
- Dark: true-neutral dark (bg `0.145`), primary brightens to `0.73 0.16 45`.
- Extra themes: `.theme-light-blue` (blue-hued neutrals, primary `0.55 0.2 250`), `.theme-glass` (translucent cards `oklch(... / 0.55)`, backdrop-blur, ambient gradient background). Theme system: 5 themes, FOUC-safe init script, persisted to localStorage `atai:theme` + DB (`/api/user/theme`) — `app/layout.tsx`, `components/theme-provider.tsx`, `app/api/user/theme/route.ts`.
- Ad-hoc accents outside tokens: purple (GitHub surfaces), emerald (success/referral), amber (warnings) — used consistently by intent but not tokenized.

**Components** (`components/ui/*`, built on `@base-ui/react` + CVA + tailwind-merge): Button (6 variants × 8 sizes), Avatar, AlertDialog, Dialog, DropdownMenu, Badge, Skeleton, Input, Textarea, Label, Sonner Toaster. Icons: lucide-react + Font Awesome CDN (database UI) + inline SVG (GitHub).

**Layout:** spacing via Tailwind gaps (gap-3/4/6/10), section rhythm `py-10 lg:py-14 px-6 lg:px-10`, cards `rounded-xl/2xl border border-border bg-card p-5/6`, sticky top-24 rails, `max-w-7xl` main containers. Radius var `--radius: 0.65rem`.

**Visual language (evidence-based):** minimal, technical-editorial — mono uppercase eyebrows + generous whitespace + restrained color; dark-first vibes with warm-orange primary; occasional playful copy in build screens ("🎪 Setting up the build circus...", joke rotation in `components/build-loading.tsx`) vs. formal founder copy elsewhere — a tonal split worth noting for redesign.

---

## 22. UX Friction Observed

Observable patterns (each with source):

1. **Dual AI surfaces, unclear division of labor** — Collaborate chat ("Small credit cost per message") vs. workspace "Continue building" prompt ("Send instruction · {buildCost} credits"). A founder cannot tell which surface owns "make a change" at which lifecycle stage (`collaborate-client.tsx` vs `project-workspace-controls.tsx`).
2. **Auto-redirect as interruption** — `plan_ready` triggers a countdown + `window.location.href` jump after 1.8 s (`project-workspace.tsx` effect). Users mid-review get yanked; back-navigation loops are possible.
3. **Dashboard doesn't answer "what now?" across projects** — checklist covers only the newest project; a `build_failed` on an older project appears only as a tiny badge.
4. **Stale dashboard copy** — ProjectList empty state still says "Enter a URL above to create your first mirror" (mirror framing retired from the rest of the UI).
5. **Header/content width mismatch** — header `max-w-5xl` vs content `max-w-7xl` (visual wobble on navigation).
6. **Credit semantics partially vestigial** — "reserved" UI on CreditMeter though reserved is always 0 (`/api/me`).
7. **Cost display inconsistencies** — four divergent build-cost definitions (§14); the workspace build button can display a different credit cost than the server will charge.
8. **Two toast systems** — react-hot-toast (workspace toasts, custom styling) vs sonner (everything else); visual inconsistency during builds.
9. **Public-project chat gate** — visitors on a public Collaborate page see "Sign in as the project owner to collaborate" only after the panel loads (read-only notice is inside ChatPanel, not the page header).
10. **Silent 404s** for github-mode artifact pages when artifacts are missing (`notFound()`), with no explanation.
11. **No notifications surface** — build events exist only while the workspace tab is open (toasts) or in the Activity card; leaving the page loses immediacy.
12. **Checklist vs. reality drift** — "Tell Atai what you're building" is hardcoded `done: true` (`onboarding-checklist.tsx`), so the first checklist item is always checked regardless of input richness.

---

## 23. Activation / Conversion Friction Observed

Funnel: **visitor → signup → project creation → first meaningful action → continued usage.**

- **Primary activation event (as implemented):** project reaching `plan_ready` and the founder entering Collaborate (this is where the product's value narrative — AI co-founder — is first felt). Tracked-ish via `recordOnboardingActivation` storing `businessDescription/source/signalType/destination` on the user (`lib/onboarding/activate.ts`, `/api/start` flow).
- **Secondary activation events:** first accepted AI proposal ("Added to your plan."), first build launch, first deploy.
- **Friction before first value:**
  1. Signup is required *before* any product experience (no guest preview; landing sections are static mockups — `components/landing/mockups.tsx`).
  2. Email verification gates the 500 welcome credits (balance shows 0 + "Verify email" until done) — a paywall-shaped moment right at first use.
  3. First Mission → `/start` is well-automated (CONFIRMED: one click from vision to a created project), but a **dismissed mission is a dead end**: only a static CTA remains, and the session-draft is lost if the browser session ends (sessionStorage only).
  4. Plan phase requires engagement to reach `plan_ready` — if analysis hasn't run yet (e.g., user landed in workspace pre-analysis), the "What we know" card shows a placeholder sentence ("Analysis is preparing the project context.").
- **Unclear CTAs:** "Review & refine plan" (PlanReadyCTA) vs. "✨ Review plan" (ProjectActions) vs. "Edit plan" (ProjectActions) — three plan-entry points with different destinations (collaborate vs. edit) and no explanation of the difference.
- **Places users may stop:** after plan_ready (credits fear — mitigated by "No credits are charged until…" copy, CONFIRMED present), during building (long waits — mitigated by BuildLoading entertainment), at publish (500-credit deploy cost appears only at the publish step for users who haven't seen /pricing).
- **Features users may never discover:** Explore forking, GitHub auto-push, source/version tools, runtime control center, referrals milestones (dashboard promo is the only pointer), plan section manual editing (hidden behind a section click → Edit).
- **No redesign proposed here** — documentation only.

---

## 24. Information Architecture

Current hierarchy (as implemented):

```
AppHeader (persistent, all authenticated pages)
├── Explore
├── ThemeToggle / CreditMeter / AccountMenu
│     └── Account / Refer & Earn / Settings / Appearance / Admin
Dashboard (home)
├── First Mission overlay (new users)
├── Greeting + All projects →
├── StartStrip (Idea / Reference / GitHub)
├── OnboardingChecklist (newest project)
├── ProjectList (4 recent)
├── Explore promo (static)
└── Referral promo (static)
Projects (full list + filters)
New (mode picker → 3 forms)
Project/[id] (workspace hub)
├── Collaborate (plan + chat + launch)
├── Plan (read-only)
├── Edit (edit workspace)
├── Source / Edit-code / Database(+table) / Env
├── Readme / Tree / Repo-code (github mode)
├── Runtime (control center)
└── (actions: publish, deploy, visibility, fork, github)
Explore · Referrals · Settings(+billing) · Admin
```

Observations: flat, hub-and-spoke IA; the **project workspace page** is the real dashboard of each business; the `/dashboard` route is a lobby. Navigation between sibling project sub-pages relies on chip rows (ProjectActions) rather than persistent per-project nav (except in-page links added ad hoc, e.g., source↔database). The IA conflates "workspace tools" (source/db/env/runtime) with "lifecycle actions" (build/publish) on one chip row.

---

## 25. Duplication / Technical Risks

1. **Build-cost duplication & divergence (HIGH):** 4 definitions — `lib/credits/credits.ts` (server truth, legacy+heavy), `lib/billing/config.ts:BUILD_TIERS` (pricing page), `components/project-workspace.tsx` (hardcoded tierCosts), `components/project-workspace-controls.tsx` (hardcoded tierCosts + followup from API). Client can show ≠ server charge.
2. **Missing endpoint (HIGH):** `GET /api/billing/overview` referenced by `app/settings/billing/page.tsx:51` but no route file exists (`find app/api/billing -type f` → no `overview/`). Billing page silently renders zeros. Working alternative exists at `/api/credits`.
3. **Plan catalog drift (HIGH):** `SUBSCRIPTION_PLANS` in code ≠ pivot-spec plan set; no `DEPRECATED_SUBSCRIPTION_PLANS` export; pricing page + billing page render the old set.
4. **Two toast libraries (MEDIUM):** `react-hot-toast` (only `components/project-workspace.tsx`) vs `sonner` (20+ files, root Toaster). Inconsistent styling during the most critical flow (builds).
5. **Polling overlap (MEDIUM):** `ProjectWorkspace` runs up to 3 SWR subscriptions (`/projects/[id]`, `/activity`, `/status`); `StateBadgeLive` adds its own `/projects/[id]` poll; `ProjectWorkspaceControls` uses `useProject` again. Server has single-flight dedup (`app/api/projects/[id]/status/route.ts`), but client interval logic is spread across four components.
6. **Card duplication (LOW):** `components/project-card.tsx` (dashboard) vs. GridCard/ListRow inside `app/projects/page.tsx` — similar but divergent (e.g., plan_ready routing exists only in `/projects` version; delete dialog duplicated).
7. **Referral reward figures (LOW):** 2,000 headline (dashboard + referral-dashboard) vs. config constants 500+1,500 (`lib/billing/config.ts`) — consistent only by addition, fragile to copy edits.
8. **Legacy localStorage migration (LOW):** pivot spec AC 1.10/1.11 requires migrating `"Atai:"`-prefixed keys to `"atai:"` — no migration code found.
9. **`specSanitized` warning duplicated** in two components (`project-workspace.tsx` inline + `project-workspace-controls.tsx` toast) — user can see it twice.
10. **Unused/legacy odds:** `verify-critique-report.ts`, `proxy.test.ts`, `mirror-site-source.zip` at repo root; a dozen root-level `*.md` status files that drift from `docs/`.
11. **No route-level code splitting issue** but `collaborate-client.tsx` is ~2,049 lines — a redesign should be aware it's one client bundle.

---

## 26. Critical Existing Functionality That Must Be Preserved

| # | Feature | Route | Key components | API | DB dependency | Why it matters |
|---|---|---|---|---|---|---|
| 1 | Auth (email/Google/GitHub, sessions, verification) | `/login` `/register` `/verify-email` | `auth/*`, `AppHeader` | `/api/auth/*`, `/api/me` | `users`, `sessions`, `verification_tokens` | Everything gates on `requireUser` |
| 2 | Project creation + pending-start continuation | `/new/*`, `/start` | `FirstMission`, `FounderIdeaForm`, `CreateProjectForm`, `CreateGitHubRepoForm` | POST `/api/projects` (idempotency), `/api/start` | `projects` | The activation spine; `PendingStart` localStorage contract (`lib/auth/client-intent.ts`) |
| 3 | Lifecycle state machine | — | `ProjectStepper`, `StateBadge`, `STATE_LABELS` | `/status` transitions | `projects.state` | Whole UI keys off 14 states; client `PLAN_STATES`/`BUILD_STATES` sets must stay in sync |
| 4 | Plan generation + sanitization | — | Collaborate, PlanReadyCTA | pipeline (server) | `projects.understanding/specification/specSanitized` | Core value |
| 5 | Collaborate: chat + proposals + auto-complete | `/project/[id]/collaborate` | `CollaborateClient` (+ portal slot `#collab-header-actions`) | `/plan-chat`, `/analyze-plan`, `/auto-complete`, PATCH `/api/projects/[id]` (`sectionUpdate`, `dismissProposalId`) | `projects.conversation/planAnalysis/planUpdateNotes` | Proposals must never auto-apply (safety invariant) |
| 6 | Launch + credit reservation | — | LaunchButton | POST `/launch` → `autoLaunchBuild` | `build_runs`, `credit_ledger`, `build_authorizations` | 409-from-non-plan_ready contract; atomic `claimBuildSlot` |
| 7 | Build status sync + reconciliation | `/project/[id]` | `ProjectWorkspace`, `BuildLoading` | GET `/status` | `projects.events`, Totalum | Server-side Totalum sync on poll is what advances state |
| 8 | Build summary + secrets | `/project/[id]` | `BuildSummaryCard` | `/status` backfill | `projects.buildSummary` | Founder-facing credentials after build |
| 9 | Publish/deploy + domains | — | `PublishMenu`, `DeploymentHistory` | `/deploy` | `deploymentHistory`, `publish_events` | 500-credit deploy; DNS flow |
| 10 | GitHub push/export + versions + recovery | `/source` etc. | `ProjectGitHubIntegration`, `SourceViewer` | `/github`, `/export`, `/versions`, `/recover` | `project_github` | Trust/escape-hatch features |
| 11 | Database + infrastructure manager | `/database` | `DatabaseProvider`, `DatabaseTablesList`, `InfrastructureManager` | `/database/*`, `/infrastructure` | Totalum | Post-build data control |
| 12 | Credits/billing | `/settings/billing`, `/pricing` | `CreditMeter`, `PlanCard`, `CheckoutButton` | `/api/billing/*`, `/api/credits` | `credit_ledger`, `payment_records`, `subscription_records`, `users.creditBuckets` | Money path; webhook idempotency |
| 13 | Explore + fork + likes + follows | `/explore` | gallery page | `/explore`, `/like`, `/fork`, `/users/[id]/follow` | `project_likes/forks`, `user_follows` | Growth loop; fork pricing `FORK_PRICING` |
| 14 | Referrals | `/referrals` | `ReferralDashboard` | `/api/referrals` | `referrals` | Milestone checks run inside `/status` (must not be dropped in refactor) |
| 15 | Runtime control center | `/project/[id]/runtime` | `runtime-control/*` | `/runtime/*` | `runtimeProvisioning`, `api_keys` | Phase-8/11 feature; secrets never in project doc |
| 16 | Admin panel | `/admin/*` | 20 pages | `/api/admin/*` | all collections | Ops lifeline |
| 17 | Visibility/fork gating | — | `ProjectVisibilityToggle` | `/visibility` | `projects.visibility` | Public requires deployed; Collaborate ACL depends on it |

---

## 27. Real vs Mock Data

**Verdict: the authenticated product runs on real data end-to-end.** Static/marketing content is the only non-live data.

| Surface | Classification | Evidence |
|---|---|---|
| Dashboard greeting, credits, projects, checklist | REAL / DERIVED | `app/dashboard/page.tsx`, `lib/client/api.ts`, `lib/store/client-store.ts` |
| Dashboard Explore & Referral promo cards | STATIC CONTENT | hardcoded JSX in `app/dashboard/page.tsx` |
| Landing page sections/mockups | STATIC CONTENT | `components/landing/sections.tsx`, `components/landing/mockups.tsx` (incl. `ManageDashboardMockup`, `PlanModeMockup`) |
| Builder count on landing | REAL API | `usePublicStats` → `/api/public/stats` (`lib/client/api.ts`) |
| Workspace stepper/badges/preview/summary/activity | REAL | `/api/projects/[id]`, `/status`, `/activity` |
| Collaborate chat/proposals/analysis | REAL | `/plan-chat`, `/analyze-plan`, PATCH `/api/projects/[id]` |
| Credit balances/history | REAL | `/api/me`, `/api/credits` (history via `/api/billing/overview` currently broken — §25) |
| Pricing page plans/packs | STATIC CONFIG (from `lib/billing/config.ts`) | `app/pricing/page.tsx` |
| Build cost labels in workspace buttons | DERIVED-BUT-STALE (hardcoded client tables) | §14 duplication findings |
| Encouragements/fun facts in BuildLoading | STATIC COPY (intentional) | `lib/build-messages.ts`, `components/build-loading.tsx` |
| MOCK DATA | **None found** in authenticated surfaces | searched `mock/hardcoded/placeholder` across components — only landing mockups matched |

---

## 28. Screenshots / Visual Evidence

**Not captured.** This audit was performed by static code inspection only; the dev server was not started and no browser automation was used, per a read-only, zero-side-effect approach. Consequently there are **no screenshots**. §5 and §29 are written to be detailed enough that a reader can visualize each screen without running the app. Anyone needing pixel evidence should run `next dev` and capture: landing, login/register, dashboard (empty + populated), `/new` + 3 forms, `/projects` (grid + list + filters), workspace per state (`plan_ready` CTA, building `BuildLoading`, ready preview + summary, deployed banner), Collaborate (plan/chat/insights/auto-complete run), plan, source, database, env, runtime, explore, referrals, settings/billing, admin (gated).

---

## 29. Current Dashboard — Full Visual Description

Top to bottom at 1440 px, dark theme (system default may render light):

- **Header (sticky, ~57 px):** translucent background (`bg-background/80` + backdrop-blur) with a 1 px bottom border. Left: "Atai" text logo (28 px), then a compact pill-style "Explore" button with compass icon (mono 12 px). Right: theme icon button (32 px bordered square), the credits chip — a bordered rounded rect with "CREDITS" label in 12 px mono muted above a tabular-nums figure like "943 / 1,000" plus a 64×32 px mini bar showing reserved share — then a 36 px round avatar (with a tiny primary-colored shield badge if admin). Below the header row, an amber banner spans full width if the email is unverified: warning icon + "Verify your email…" text + "Resend" button.
- **First Mission overlay (new users only; covers everything):** solid background, top bar with brand + eyebrow "01 / YOUR VISION", centered 2xl column: "Welcome, {name}.", huge `font-black` headline "What are you building?", muted description, a 6-row rounded-2xl textarea ("I'm building…"), a detected-mode hint line ("Detected: URL reference. Change"), 4 mode chips (Idea / Mirror / URL / GitHub — selected chip gets indigo-tinted border/background), hint text, 4 quoted examples in small muted text. Footer bar: ghost "I'll do this later" left; primary "Let's get to work" right. Phase 2 swaps to "02 / CONTEXT" with the follow-up question, an echo of the vision in a bordered card, capability chips (Product direction, Business model, …) and two buttons ("I've got enough to get started" outline / "Let's get to work" primary).
- **Main column (`max-w-7xl`, `py-10 lg:py-14`, `px-6 lg:px-10`):**
  - *Greeting band:* tiny mono orange eyebrow "DASHBOARD"; "Good to see you, {First}." at 4xl→6xl semibold; a 2-line muted subcopy; right side a bordered card-button "🗂 All projects →". A full-width bottom border closes the band.
  - *(If dismissed onboarding, no projects)* a rounded-3xl card "01 / YOUR VISION / What are you building?" with primary CTA "Start with Atai".
  - *(If projects)* "New project" mono label with three pill links (Idea / Reference / GitHub).
  - *(If projects and steps remain)* a rounded-2xl card "YOUR FIRST BUILD" with the newest project's name; four rows each with a 20 px circular check (emerald when done) and label; rows are links.
  - *"RECENT PROJECTS" mono section header* with count and "View all →". A 4-up grid of cards: optional 16:7 thumbnail with a bottom gradient and a state pill overlaid; otherwise an icon tile + badge row; title in mono 13 px, mode label in 10 px mono uppercase ("IDEA BUILD" etc.), footer with "3m ago" and hover-revealed "Open →". A hover trash icon (top-right) opens a centered confirm dialog.
  - *(If >4 projects)* a full-width row "N more projects in your workspace · View all projects →".
  - *Explore card:* rounded-2xl bordered card, 44 px icon tile (compass, primary/10), bold "See what other founders are building", two-line muted body, right-side primary-tinted button "Browse the library →".
  - *Referral card:* same shape but emerald-tinted border/background, trending-up icon, body with bold "2,000 Atai Credits" inline, emerald button "Get your referral link →".
- **Interactions:** all cards are static except project cards, checklist rows, and the promos' links. No hover-reveal menus, no drag/drop, no inline editing on this page.
- **Responsive:** single column below `lg`; project grid 2-up at `sm`; header swaps Explore pill to a compact icon+label; greeting scales down to text-4xl; promo cards stack.
- **Feel:** quiet, editorial, roomy — a lobby, not a control room.

---

## 30. Unknowns / Missing Information

- **Runtime behavior:** polling latency, Totalum build durations, real fail rates — requires a running environment (not measured).
- **Feature flags / env:** which integrations are configured in production (`isTotalumConfigured`, `isFirecrawlConfigured`, Dodo products via env) — visible only as booleans at runtime.
- **Admin surface details:** 20 admin pages exist; their internal quality was not audited screen-by-screen (out of scope for the founder dashboard).
- **Landing "sections" content depth:** `components/landing/sections.tsx` was not read line-by-line; mockups confirmed static.
- **Whether `/api/billing/overview` failure is known/intentional:** endpoint absent in repo; maybe planned, maybe deleted — the client guard makes it non-fatal.
- **Mobile behavior of Collaborate split:** `collapsedOnMobile` exists on PlanNav; exact breakpoint behavior is inside the unread remainder of `collaborate-client.tsx` (lines 1232–2049).
- **i18n:** none observed; everything is English.
- **Analytics:** Vercel Analytics in production only (`app/layout.tsx`); no event taxonomy found.

---

## 31. Files & Components Most Relevant To Future Redesign

**Dashboard core (will be touched first)**
- `app/dashboard/page.tsx` — composition root
- `components/app-header.tsx`, `components/brand-logo.tsx`, `components/credit-meter.tsx`, `components/account-menu.tsx`, `components/verify-email-banner.tsx`, `components/theme-toggle.tsx`
- `components/project-list.tsx`, `components/project-card.tsx`, `components/state-badge-live.tsx`, `components/state-badge.tsx`
- `components/onboarding-checklist.tsx`, `components/onboarding/{first-mission,activation-empty,start-strip}.tsx`
- `lib/onboarding/{state,copy,activate}.ts`, `lib/start/detect-input.ts`, `lib/auth/client-intent.ts`

**Data layer the redesign must reuse (do not fork)**
- `lib/client/api.ts` (`useSession`, `useProjects`, `useProject`, `useProjectActivity`, `useProjectStatus`, fetch helpers with `{ok,data}` envelope)
- `lib/store/client-store.ts` (Zustand session/projects/credit-costs caching discipline)
- `lib/types/project.ts` (ProjectState + labels; `ProjectSummary`)
- `app/api/projects/route.ts`, `app/api/me/route.ts`

**Patterns to match**
- `app/projects/page.tsx` (filter tabs, counts, empty states, grid/list, delete dialog)
- `app/project/[projectId]/collaborate/collaborate-client.tsx` (plan health, statuses, proposals)
- `components/project-workspace.tsx` (state-driven conditional sections; PlanReadyCTA / ReadyToBuildCTA / DevPreview / BuildSummaryCard patterns)
- `components/ui/*` (Base UI + CVA primitives)

**Config / drift sites to consolidate before or during redesign**
- `lib/credits/credits.ts` (tier costs — server truth)
- `lib/billing/config.ts` (plans, packs, referral constants)
- `components/project-workspace.tsx` + `components/project-workspace-controls.tsx` (hardcoded client cost tables)
- `app/settings/billing/page.tsx` → missing `/api/billing/overview`

**State-machine references**
- `components/project-stepper.tsx` (phase mapping)
- `components/onboarding-checklist.tsx` (PLAN_STATES / BUILD_STATES sets)
- `app/projects/page.tsx` FILTER_GROUPS (state → funnel grouping)

---

## What Another AI Needs To Know Before Redesigning Atai

1. **The lifecycle is the product.** Everything keys off the server-persisted 14-state `ProjectState` (`lib/types/project.ts`). Any dashboard redesign should derive its sections from that enum (planning / building / live / failed groupings already exist in `app/projects/page.tsx:FILTER_GROUPS` and `components/onboarding-checklist.tsx`). Never infer state client-side.
2. **Data access pattern is fixed and good:** `{ ok, data }` envelope + SWR for volatile data + Zustand (`lib/store/client-store.ts`) for session/projects with explicit invalidation. Reuse `useSession`/`useProjects`; don't introduce a parallel fetch layer. Respect the polling budgets (10 s active / 60 s idle; `/status` only during active builds) — they exist because `/status` triggers server-side Totalum sync.
3. **The dashboard is currently a lobby.** The real per-business state lives in the workspace and Collaborate. The single biggest redesign opportunity — consistent with the codebase — is surfacing: (a) projects needing action (`plan_ready`, `build_failed`, insufficient-credit events), (b) recent project `events` as a cross-project feed, (c) lifecycle-derived milestones. All of this data already exists via existing endpoints (`/api/projects`, `/api/projects/[id]/activity`); nothing new is required.
4. **Two navigation realities:** no sidebar anywhere; a single `AppHeader`. The redesign can introduce a sidebar, but must keep `AppHeader` semantics (credit meter, account menu, verify banner) or migrate them deliberately.
5. **Costs shown in UI must come from one source.** Before displaying any credit figures, consolidate the four divergent tier-cost definitions; server truth is `getTierCost()` in `lib/credits/credits.ts` (legacy vs heavy modes differ).
6. **Known breakage to fix before launch of any new billing UI:** `/api/billing/overview` doesn't exist; use `/api/credits` or add the route.
7. **Spec ≠ code.** The pivot spec (`.kiro/specs/atai-pivot/requirements.md`) describes plans, onboarding, SDK, and business-overview features that are not implemented. Design against the code, and flag spec items as roadmap, not current reality. (The current plans are Free/Explorer/Starter/Business/Professional/Enterprise per `lib/billing/config.ts`.)
8. **Safety invariants to preserve:** proposals never auto-apply; launch only from `plan_ready` (409 otherwise); credits reserve before build and refund on failure; public visibility only when deployed; secrets never rendered client-side (BuildSummary lists key *names* only).
9. **Tone duality is deliberate-ish:** formal founder copy in planning surfaces, playful dev-humor in build screens (`build-loading.tsx`). Pick a tone policy explicitly when redesigning.
10. **Design system constraints:** Tailwind v4 + OKLCH tokens in `app/globals.css` with 5 themes (incl. glass) managed by `components/theme-provider.tsx` + FOUC script; Base UI primitives in `components/ui`; mono uppercase eyebrows are the house style. Dark-first. Don't hardcode theme classes on `<html>`.
11. **Onboarding entry points to preserve:** First Mission surface rules (`lib/onboarding/state.ts`), `?mission=1` force param, `PendingStart` intent (localStorage) consumed by `/start`, and `dismissedAt/completedAt` on the user record — the dashboard's empty states branch on these.
12. **Don't break the auto-redirect users already expect:** `plan_ready → Collaborate` is heavily signposted today; if the redesign removes the redirect, it must provide an equally loud "your plan is ready" affordance.

---

### Final Quality Check

- [x] Inspected the actual codebase (routes, components, hooks, API routes, store, pipelines)
- [x] Inspected the actual routes (full route map, §4)
- [x] Inspected the actual dashboard (§5, §6, §29)
- [x] Traced dashboard data (§7)
- [x] Identified real vs mock data (§27 — no mock data in authenticated surfaces)
- [x] Inspected project creation (§9, §10 — `/new/*`, `/start`, `continue-start.ts`)
- [x] Inspected onboarding (§10 — First Mission surface rules)
- [x] Inspected workspace flows (§5, §9, §14–16)
- [x] Inspected AI collaboration (§12, §13)
- [x] Inspected build-related flows (§14, §19)
- [x] Inspected usage/billing (§17)
- [x] Inspected responsive behavior (§20 — via class analysis; no runtime testing)
- [x] Identified critical dependencies (§26)
- [x] Identified duplication risks (§25)
- [x] Did not modify the codebase (this document in `docs/` is the only artifact added, per the user's explicit request)
- [x] Did not install anything
- [x] Did not redesign anything (§23/§25 document friction without prescribing solutions; the closing handoff lists constraints, not redesigns)
- [x] Clearly separated confirmed facts from assumptions (CONFIRMED / INFERRED / UNKNOWN throughout)
- [x] Provided file/component references (every section)
- [x] Screenshots: explicitly not possible under read-only static method (§28)
