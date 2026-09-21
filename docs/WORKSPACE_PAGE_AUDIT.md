# Project workspace page — full product & engineering audit

**Audience:** product design and engineering. Written so someone who has never opened this surface can understand what it is, what it can do, when each piece appears, and how it is implemented.

**Canonical URL:** `/project/[projectId]`  
**Example:** `/project/78a47dd5-e2e9-410f-b8b7-ab5f65ce1981`

**Last audited against:** the current workspace shell (`app/project/[projectId]/page.tsx` + `components/project-workspace.tsx` and related tools). This is the owner’s live floor for one product — not Collaborate, not Runtime, not Edit. Those are linked rooms.

---

## 1. What this page is

The workspace is the **home of one Atai project**. It is where the founder sees:

- what the product is
- which phase the work is in
- who is “on the floor” (co-founder / engineering / launch)
- the live preview when a build exists
- how to instruct the team, publish, connect GitHub, and open deeper tools

It is **not** the plan-review room (`/collaborate`), not the source editor (`/edit`), and not the runtime control center (`/runtime`). Those are destinations from this page.

**Product job:** make the founder feel they are on the floor with Atai while the product is planned, built, and shipped — without hiding the real capabilities.

**Engineering job:** keep one source of truth (persisted `Project.state` in the store), poll live status during active work so Mongo does not look stale, and gate every mutating action on ownership.

---

## 2. Who can open it

| Rule | Behavior |
|---|---|
| Not signed in | Redirect to `/login?next=/project/{id}` |
| Signed in, not the owner | `404 notFound()` (no leak that the project exists) |
| Signed in, owner | Full workspace |

Enforced in the server page via `getCurrentUser()` + `store.getProject(projectId)` and `project.userId !== user.id`.

**Note:** Collaborate has a different rule (public projects can be viewed by others). The workspace itself is **owner-only**.

---

## 3. Mental model (for someone new)

Think of three layers stacked:

1. **App chrome** — global Atai header (logo, Explore, credits, account).
2. **Project chrome** — sticky bar: name, live state, tool rail.
3. **Floor** — left: phase timeline. Right: whatever this project needs *right now* (plan CTA, preview, instruct, publish, log).

Work always moves through a **persisted lifecycle**. The UI never invents state. Polling only *reads* it (and `/status` may advance it server-side when Totalum reports done/failed).

Typical founder path:

```
/new (idea | competitor website | GitHub)
  → analysis / plan
  → /project/{id} (this page)
  → /project/{id}/collaborate (review plan, then start build)
  → this page again while building
  → preview + instruct + publish + runtime
```

---

## 4. Files that *are* this page

| File | Role |
|---|---|
| `app/project/[projectId]/page.tsx` | Server page: auth, load project, chrome, tool rail |
| `app/project/[projectId]/project-actions.tsx` | Client tool rail (conditional links) |
| `components/project-workspace.tsx` | Client floor: briefing, CTAs, preview, publish, GitHub, instruct, log |
| `components/project-workspace-controls.tsx` | Build button + follow-up instruction |
| `components/project-stepper.tsx` | Five-phase timeline |
| `components/project-activity.tsx` | Event log |
| `components/project-assets.tsx` | Screenshots + upload |
| `components/project-github-integration.tsx` | Connect / push / disconnect GitHub |
| `components/project-visibility-toggle.tsx` | Public / private |
| `components/publish-menu.tsx` | Deploy subdomain or custom domain |
| `components/deployment-history.tsx` | Past deploys |
| `components/build-loading.tsx` | Live build / deploy waiting UI |
| `components/github-scroll-button.tsx` | Scrolls to `#github-integration` |
| `components/state-badge-live.tsx` | Live state pill in the sticky bar |
| `components/app-header.tsx` | Global header |
| `lib/workspace/now.ts` | Team kicker + “is live work happening” |
| `lib/dashboard/view-model.ts` → `interpretProjectState` | Headline, description, primary/secondary actions |
| `lib/types/project.ts` | `ProjectState`, project shape |

Inline helpers inside `project-workspace.tsx` (not separate files):

- `PlanReadyCTA` — plan-ready banner + 8s auto-redirect to Collaborate
- `ReadyToBuildCTA` — start-build banner (spec ready / fork / awaiting confirmation)
- `CapturePreviewButton` — screenshot the live app
- `DevPreview` — iframe preview with desktop/tablet/mobile + drag height
- `BuildSummaryCard` — post-build agent summary (markdown)

---

## 5. Layout anatomy (top → bottom)

### 5.1 Global header (`AppHeader`)

Sticky. Contains:

- Brand logo → home
- Co-founder launcher
- Explore
- Feature requests
- Theme toggle
- Credit meter
- Account menu
- Email verification banner (if unverified)

**Design note:** header inner width is `max-w-7xl`. Workspace body is `max-w-[1500px]`. The two columns do not share the same edges.

### 5.2 Sticky project bar (`page.tsx`)

`sticky top-[57px]` (assumes ~57px header). Contains:

- **Dashboard** → `/dashboard` (`DashboardLink`; `projectId` is unused)
- **Project name** (`project.name`)
- **Live state badge** (`StateBadge`) — polls `/api/projects/{id}` and shows human labels (`Building`, `Review plan`, `Ready`, …)
- **Subtitle** — `sourceUrl` or `idea` or `"Project workspace"`
- **Tool rail** (`ProjectActions`) — see §6

### 5.3 Now briefing (`ProjectWorkspace` top card)

Always rendered once project client data is in play.

| Element | Source |
|---|---|
| Kicker (“Co-founder · Research”, “Engineering team · Build”, …) | `workspaceTeam(state)` |
| Live pulse dot | `workspaceIsLive` = analyzing \| building \| deploying |
| Headline | `interpretProjectState(state).headline` |
| Body | team floor sentence + briefing description |
| `Now · {message}` | latest event from `/status` or `/activity` |
| Primary / secondary buttons | briefing actions **unless** they point at this same workspace URL (avoids a no-op “Open project”) |
| **Open preview** | if `project.developmentUrl` exists; new tab, protocol-normalized |

### 5.4 Two-column floor

**Left rail (280px, sticky `top-36`):**

- **Build floor** — `ProjectStepper`
- Helper copy: “You’re on the floor with the team.”

**Right column:** conditional blocks in a fixed order (see §7). Empty states still show Product brief + Instruct (when not building) + Floor log + Assets.

---

## 6. Tool rail — every control

Rendered in `ProjectActions`. Items **hide** unless their condition is true, except Edit plan, Runtime, GitHub scroll, and Export (those always show).

| Label | Condition | Destination | What it actually does |
|---|---|---|---|
| View plan | `project.specification` exists | `/project/{id}/plan` | Read-only / structured plan view |
| Review plan | spec exists **and** `state === "plan_ready"` | `/project/{id}/collaborate` | Co-founder plan review room |
| Edit plan | always | `/project/{id}/edit` | Edit workspace: spec, settings, agent |
| Source | `isBuilt` = `Boolean(totalumProjectId)` | `/project/{id}/source` | Generated source after a Totalum build exists |
| Runtime | always | `/project/{id}/runtime` | Runtime control center (may be empty pre-build) |
| Database | built | `/project/{id}/database` | Tables / records of the running app |
| .env | built | `/project/{id}/env` | Secrets / env for the running app |
| README | `project.githubReadme` | `/project/{id}/readme` | GitHub-sourced README (GitHub-mode projects) |
| App tree | `project.githubFileTree` | `/project/{id}/tree` | Repo file tree |
| Repo code | `project.githubZipUrl` | `/project/{id}/repo-code` | Downloaded zip view |
| GitHub (scroll) | always | `#github-integration` | Smooth-scrolls to GitHub panel **if that panel is mounted** |
| Preview | `developmentUrl` | external `https://…` | Opens the development app in a new tab |
| Export | always | `GET /api/projects/{id}/export` | Downloads a JSON snapshot (not the git repo) |

**Export payload** includes: id, name, mode, state, sourceUrl, idea, understanding, specification, developmentUrl, events, conversation, createdAt, updatedAt. It does **not** include source code, env secrets, or Totalum internals.

**Product/eng gap:** GitHub scroll is always in the rail, but the GitHub panel only mounts when state is `ready` \| `build_complete` \| `specification_ready`. On other states the button does nothing visible.

---

## 7. Right column — every block, in render order

Each block is independently gated. Several can show at once.

### 7.1 Plan ready CTA — `PlanReadyCTA`

**When:** `state === "plan_ready"` **and** `project.specification`

**What founders see:** “Your app plan is ready!” + Action needed + countdown.

**Behavior:**

- Counts down **8 seconds**, then `window.location.href = /project/{id}/collaborate`
- **Stay on this page** cancels the redirect
- Copy states credits are **not** charged until “Submit Plan & Start Building” in Collaborate
- Link: Review & refine plan → Collaborate

**Eng notes:** hard navigation (`window.location`), not `router.push`. Countdown is client-only; refresh restarts it.

### 7.2 Source screenshot (browser chrome)

**When:** `understanding.screenshots[0]` exists (typical for website / competitor starts)

Shows a fake browser chrome, source URL, Visit ↗, and the screenshot (opens full image).

### 7.3 Plan auto-adjusted warning

**When:** `project.specSanitized`

Explains unsupported stack pieces (e.g. PostgreSQL, Prisma) were rewritten to Totalum SDK equivalents. Repeated again inside Instruct controls.

### 7.4 Product brief

**Always.**

- Mode: `website` \| `scratch` (idea) \| `github`
- Counts: `events.length`, `conversation.length`
- Title: `understanding.purpose` or fallback “The co-founder is still gathering product context.”

### 7.5 Ready to build CTA — `ReadyToBuildCTA`

**When:** state is `specification_ready` **or** `awaiting_build_confirmation` **or** `analysis_complete`, **and** a specification exists.

**Actions:** `POST /api/projects/{id}/build` with `{}`.

Shows complexity tier + credit cost from `useBuildCosts()` (display only; server re-prices at launch). Forked projects (`events` with `stage === "fork"`) get different copy.

**Overlap:** Instruct panel also has a Build button. Two start-build entry points on the same page.

### 7.6 Build failed

**When:** `state === "build_failed"`

- Retry → `POST /api/projects/{id}/build`
- Edit project settings → `/edit`

### 7.7 Deployment failed

**When:** `state === "deployment_failed"`

- Retry → `POST /api/projects/{id}/deploy`
- Copy: development app still available

### 7.8 Build / deploy loading — `BuildLoading`

**When:** `state === "building"` **or** `"deploying"`

Elapsed timer, rotating encouragement, agent messages from `/status` (poll **3s** inside this component — see §10). On success, waits 2.5s then `router.refresh()`. Own retry to `/build`.

### 7.9 Live production banner

**When:** last successful `deploymentHistory` entry has `productionUrl`

Opens production URL in a new tab.

### 7.10 Development preview — `DevPreview`

**When:** `developmentUrl` exists

Iframe of the running app.

- Viewport: desktop 100% / tablet 768px / mobile 375px
- Drag handle: height 200–1200px
- Open in new tab

### 7.11 Capture preview

**When:** state `ready` or `build_complete`, has `developmentUrl`, **no** screenshot yet

`POST /api/projects/{id}/capture-preview` — screenshot for dashboard/workspace banner.

### 7.12 Build summary

**When:** `project.buildSummary`

Markdown from the agent after a finished build (credentials needed, what’s included, next steps). Older projects without the field trigger a one-shot `/status` backfill.

### 7.13 Publish — `PublishMenu`

**When:** `ready` or `build_complete` **and** `totalumProjectId`

Capabilities:

- Deploy to Atai/Totalum subdomain (`POST /deploy`) — charges credits, toasts amount
- Custom domain: deploy if needed, then DNS records, confirm / remove
- Polls `GET /api/projects/{id}/deploy` while deploying (10s)

### 7.14 Deployment history

**When:** state in `ready` \| `build_complete` \| `deployed` \| `deploying` **and** history length > 0

### 7.15 Visibility — `ProjectVisibilityToggle`

**When:** `ready` or `build_complete`

- Private (default) vs public
- Public URL: `/public/{projectId}`
- `PATCH /api/projects/{id}/visibility`
- Cannot go public until built (`ready` / `build_complete` / `deploying` / `deployed`); toast if attempted earlier
- UI copy also says “Deploy first” in one branch vs “Build first” in another — wording mismatch

### 7.16 GitHub — `ProjectGitHubIntegration`

**When:** `ready` \| `build_complete` \| `specification_ready`

Capabilities:

- Detect GitHub OAuth (`GET /api/github/repos`)
- Sign in with GitHub (`/api/auth/github?next=/project/{id}`)
- Connect existing repo (modes: **push** after each build, or **build-from** as analysis source)
- Create a **private** repo (`POST /api/github/repos`)
- Disconnect (`DELETE /api/projects/{id}/github`)
- Manual push when built (`POST` integration helpers in the same component)
- Status: last push SHA, errors

### 7.17 Instruct the team — `ProjectWorkspaceControls`

**When:** state is **not** `building` and **not** `deploying`

| Control | Enabled when | API | Credits |
|---|---|---|---|
| Build `{tier} · N credits` | specification exists | `POST /build` | build cost by complexity + pipeline mode |
| Open preview | `developmentUrl` | — | — |
| Instruction textarea | `totalumProjectId` (already built) | `POST /agent` `{ prompt }` | follow-up cost by tier |
| Send instruction | prompt ≥ 3 chars | same | shown on button |

Disabled while busy. Errors inline. After success, refreshes project + session (credits).

**Product note:** founders cannot send follow-up instructions until the first Totalum build exists. Before that, only Build (if a plan exists) is useful here.

### 7.18 Floor log — `ProjectActivity`

Always.

- `useProjectActivity` (shared SWR cache with Edit / conversation)
- Filters out internal “Fetch GET /api/v1/…” noise
- Newest first; stage + relative time
- Faster poll when `isBuilding` (live analyzing/building/deploying)

### 7.19 Captured assets — `ProjectAssets`

Always.

- `GET/POST /api/projects/{id}/assets`
- Screenshots from crawl + other assets
- Upload image: png / jpeg / webp / gif
- Empty: “No screenshots…” + upload

---

## 8. Project lifecycle (the real state machine)

Persisted on the project. Never inferred only in the browser. Type: `ProjectState` in `lib/types/project.ts`.

| State | Founder meaning | Badge | Stepper phase | Live work? |
|---|---|---|---|---|
| `created` | Saved, not analyzed yet | Created | Reference captured | no |
| `pending_plan` | Plan not ready yet | Pending plan | falls through to captured (index 0) | no |
| `analyzing` | Reading idea / site / repo | Analyzing | Understanding | **yes** |
| `analysis_complete` | First look done | Analysis done | Understanding | no |
| `specification_ready` | Spec exists, may build | Plan ready | Plan ready | no |
| `plan_ready` | Needs human review | Review plan | Plan ready | no |
| `awaiting_build_confirmation` | Waiting for Build | Awaiting confirmation | Plan ready | no |
| `building` | App being written | Building | Building | **yes** |
| `build_complete` | Build finished | Build complete | Building | no |
| `build_failed` | Build stopped | Build failed | Building (failed) | no |
| `ready` | Dev app available | Ready | Live | no |
| `deploying` | Going to production | Deploying | Live | **yes** |
| `deployed` | Production live | Deployed | Live (done) | no |
| `deployment_failed` | Publish failed | Deploy failed | Live (failed) | no |

**Modes** (`ProjectMode`): `website` (competitor / URL), `scratch` (idea), `github`.

**Pipeline:** `legacy` (faster) vs `heavy` (7-stage). Affects **credit cost**, not which workspace blocks render.

**Displayed state** prefers `/status` while polling, else `/api/projects/{id}`. Comment in code: `/projects` alone can be **stale during builds**; `/status` syncs Totalum and can move `building → ready` or `build_failed` and reconcile credits.

---

## 9. Linked rooms (not on this page, opened from it)

These are separate routes. The workspace is the hub.

| Room | Path | Purpose |
|---|---|---|
| Collaborate | `/project/{id}/collaborate` | Plan in plain language, chat, submit plan & start building |
| Plan | `/project/{id}/plan` | Plan document |
| Edit | `/project/{id}/edit` | Spec/settings/agent/source-adjacent editing |
| Source | `/project/{id}/source` | Generated code |
| Runtime | `/project/{id}/runtime` | Overview of the running app |
| Runtime health / keys / limits / models / requests / usage | `/runtime/*` | Control center |
| Database | `/project/{id}/database` | Tables |
| Table | `/project/{id}/database/[tableName]` | Records |
| Env | `/project/{id}/env` | Secrets |
| README / tree / repo-code | GitHub-mode artifacts | |
| Public page | `/public/{id}` | If visibility = public |

---

## 10. Data fetching & polling (engineering)

All owner-gated JSON `{ ok, data }` unless noted.

### 10.1 Server (first paint)

`store.getProject` for name, state, source label, `totalumProjectId` (tool rail `isBuilt`). Tool rail **does not live-update** after first paint (SSR snapshot). New tools (Preview, Source) appear only after a full navigation/refresh of the server page. The **floor** does live-update via SWR.

### 10.2 Client SWR inside `ProjectWorkspace`

| Key | When | Interval | Why |
|---|---|---|---|
| `GET /api/projects/{id}` | always | 10s if analyzing/building/deploying, else 60s | Full project |
| `GET /api/projects/{id}/activity` | always | same | Events + toasts |
| `GET /api/projects/{id}/status` | only if analyzing/building/deploying | 10s | Totalum sync, state advance, credits |

Also: `revalidateOnFocus`, `keepPreviousData`, `dedupingInterval: 5000`.

### 10.3 Extra polls (easy to over-fetch)

| Source | Interval |
|---|---|
| `StateBadge` | own SWR on `/api/projects/{id}` |
| `BuildLoading` | `/status` every **3s** while building/deploying (in addition to workspace 10s) |
| `ProjectWorkspaceControls` → `useProject(..., { pollWhileBuilding: true })` | another project poll |
| `ProjectActivity` → `useProjectActivity` | activity cache (shared with Edit) |
| `PublishMenu` | `/deploy` every 10s while deploying |
| `ProjectAssets` | assets endpoint |

**Toasts:** newest event from status or activity; skip duplicates by event id; error / warn / celebratory (🎉 ✨) / default via sonner.

**Cache merge:** when `/status` reports `ready` or `build_failed` and includes `project`, it writes into the project SWR cache then revalidates.

---

## 11. APIs this page calls directly

| Method | Path | Used by |
|---|---|---|
| GET | `/api/projects/{id}` | workspace, state badge, controls |
| GET | `/api/projects/{id}/activity` | workspace, activity |
| GET | `/api/projects/{id}/status` | workspace (active), build loading, summary backfill |
| POST | `/api/projects/{id}/build` | ReadyToBuild, failed retry, controls, BuildLoading retry |
| POST | `/api/projects/{id}/agent` | instruct follow-up |
| POST | `/api/projects/{id}/deploy` | failed deploy retry, PublishMenu |
| GET | `/api/projects/{id}/deploy` | PublishMenu poll |
| POST | `/api/projects/{id}/capture-preview` | capture button |
| GET/POST | `/api/projects/{id}/assets` | assets |
| GET/POST/DELETE | `/api/projects/{id}/github` | GitHub panel |
| GET/POST | `/api/github/repos` | GitHub OAuth check, list, create repo |
| GET | `/api/auth/github?next=…` | GitHub sign-in |
| PATCH | `/api/projects/{id}/visibility` | public/private |
| GET | `/api/projects/{id}/export` | Export download |

Build and agent costs are **authoritative on the server**. The UI shows `useBuildCosts()` numbers for display.

---

## 12. Credits (what founders need to know)

- **Planning / reviewing** on this page does not charge.
- **First build** charges by complexity tier + pipeline mode (`legacy` vs `heavy`).
- **Follow-up instruction** (`POST /agent`) charges follow-up cost; requires an existing Totalum project.
- **Deploy** charges; toast includes `creditsCharged`.
- Credit meter in the header; session refresh after build/instruct.

Collaborate copy: no charge until “Submit Plan & Start Building”. Workspace ReadyToBuild / Instruct Build can still start a build **without** going through Collaborate — product should treat these as the same spend.

---

## 13. Access, ownership, safety

- Workspace GET/PATCH project: owner only (`UNAUTHORIZED_PROJECT_ACCESS` / 404).
- Single-flight on `GET /api/projects/{id}` to collapse poll storms.
- Follow-up agent cannot run without `totalumProjectId`.
- Build cannot start without a specification (button disabled).
- Public visibility is a **listing/share** flag (`/public/{id}`), not “anyone can open `/project/{id}`”.
- Export is an attachment download; no-store cache.

---

## 14. Design system on this page

- Panels: `rounded-2xl border-border/80 bg-card/90`
- Kickers: `font-mono text-[11px] uppercase tracking-[0.18em]`
- Now briefing: `from-primary/[0.07]` gradient
- Live work: pinging primary dot
- Destructive: failed build/deploy cards
- Success: live URL / preview CTAs emerald
- Tool chips: default / accent / success / warn / violet

Copy is mixed: briefing uses Atai founder voice (`interpretProjectState`); some CTAs still say “Your app plan is ready!”, “🔨 Build now”, “📸 Capture preview”. Instruct says “Tell the engineering team…”.

---

## 15. Capabilities map (product checklist)

A founder **can**, from this page, depending on state:

1. See what phase they are in and the latest floor message  
2. Jump to dashboard  
3. Open plan, collaborate, edit, runtime, database, env, source, GitHub artifacts  
4. Open development preview (new tab + in-page iframe)  
5. Open production URL after a successful deploy  
6. Auto-jump to Collaborate when the plan is ready (or stay)  
7. Start a build (ReadyToBuild or Instruct)  
8. Retry a failed build or failed deploy  
9. Send a post-build instruction to the agent (credits)  
10. Publish to subdomain or custom domain  
11. See deployment history  
12. Toggle public/private and copy public URL  
13. Connect GitHub, create a private repo, auto-push, or disconnect  
14. Capture a preview screenshot  
15. Upload extra images  
16. Read crawl screenshots and the product purpose  
17. Read the post-build agent summary  
18. Export a JSON snapshot  
19. Watch live build/deploy progress without leaving  

A founder **cannot** from this page (must leave):

- Edit plan sections in the Collaborate UI  
- Browse/edit database records (Database room)  
- Edit env/secrets (Env room)  
- Inspect runtime keys, usage, models (Runtime rooms)  
- Chat as co-founder (Collaborate / co-founder launcher in header)  
- Change billing  

---

## 16. Issues & design/eng debt (be critical)

Use this as a punch list, not as blame.

1. **Tool rail is SSR-stale.** Preview/Source/Database appear only after a server re-render. After a build completes in the client, the floor updates but the rail may still look pre-build until refresh.

2. **GitHub scroll with no target** on most pre-ready states.

3. **Duplicate build entry points:** PlanReady (Collaborate), ReadyToBuild, Instruct Build, BuildLoading retry, build_failed retry.

4. **Duplicate preview entry points:** briefing, tool rail, Instruct “Open preview”, DevPreview chrome.

5. **Polling overlap:** `/status` at 10s (workspace) + 3s (BuildLoading); `/projects` from workspace + StateBadge + controls.

6. **Header vs body max-width** mismatch (`7xl` vs `1500px`).

7. **Stepper vs states:** `pending_plan` is not a first-class phase. `build_complete` sits in “Building” not “Live”. Website-centric blurbs (“Your URL or idea”, “Reading pages”) on idea/GitHub projects.

8. **Visibility copy** disagrees with itself (build vs deploy first). Toggle UI still uses the older `rounded-lg` card inside the new panel language.

9. **`DashboardLink` unused `projectId`.**

10. **Hard redirect** on plan-ready (`window.location`) drops client cache and can surprise if the founder wanted to stay (they can cancel, but only after noticing).

11. **Instruct hidden during building/deploying** — correct for not stacking jobs, but founders cannot queue a follow-up.

12. **Export is metadata JSON**, not source. Label can over-promise.

13. **Voice inconsistency** between Atai briefing, emoji CTAs, and “engineering team” instruct.

14. **Public projects:** workspace still owner-only; sharing is `/public` and Collaborate, which is easy to confuse with “make the workspace public”.

---

## 17. Quick test matrix

| Start | Expect on `/project/{id}` |
|---|---|
| New idea, still analyzing | Briefing “studying”, stepper Understanding, pulse, no preview, Instruct waiting for plan |
| Plan just finished | PlanReady banner, 8s to Collaborate, Review plan in rail |
| Spec ready / fork, not plan_ready | ReadyToBuild + credit tier |
| Building | BuildLoading, Instruct hidden, rail may still be pre-build until refresh |
| Ready, has `developmentUrl` | Iframe, Open preview, Publish, Visibility, GitHub, Instruct follow-up |
| Build failed | Red alert + retry + edit |
| Successful production deploy | Green live URL + history |
| GitHub-mode with readme/tree | README / App tree / Repo code chips |

---

## 18. One-sentence summary

**`/project/[id]` is the owner-only operations floor for a single Atai product: it shows live phase and preview, starts and retries builds, takes paid follow-up instructions after the first build, publishes, attaches GitHub, and routes into plan, edit, database, env, source, and runtime — all driven by persisted `Project.state`, not by the frontend guessing.**
