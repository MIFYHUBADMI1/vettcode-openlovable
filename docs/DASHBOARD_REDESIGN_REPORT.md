# Atai Founder Command Center — Implementation Report

## 1. What changed

Home (`/dashboard`) is no longer a greeting + project-card lobby. It is a founder command center: current business state, next action, attention, journey, activity, AI work, compact businesses list, then usage/discover.

The dashboard uses a collapsible sidebar + top bar (search, notifications, credits, help, theme, account). First Mission, PendingStart, and activation empty states are preserved.

Plan-ready workspace no longer hard-jumps after 1.8s. Collaborate opens after an 8s countdown with a **Stay on this page** cancel.

## 2. New information architecture

- **Sidebar:** Home, Businesses, New business, Explore, recent businesses, Settings, Ask Atai
- **Top bar:** page title, local project search, notifications, CreditMeter, help, theme, account
- **Main:** next action → attention + journey → activity + AI team → businesses → usage / discover / referrals
- **Mobile:** drawer navigation; stacked command-center sections

## 3. New dashboard component tree

```
app/dashboard/page.tsx
  DashboardShell
    sidebar / mobile drawer / top bar
    DashboardNotifications
    DashboardCommandCenter
      FirstMission | ActivationEmpty | DashboardEmpty
      NextActionCard
      AttentionList + JourneyCard
      ActivityPanel + AiTeamCard
      BusinessesList
      UsageCard + DiscoverCard + ReferralCard
lib/dashboard/view-model.ts
```

## 4. Data sources used by each section

| Section | Source |
|---|---|
| Auth / greeting / credits | `useSession` (`/api/me`) |
| Projects / active business | `useProjects` (`/api/projects`) |
| Next action / journey / attention | `projects.state` via `interpretProjectState` |
| Activity / notifications | `useProjectActivity` for the **active project only** |
| Ask Atai | `/project/[id]/collaborate` (existing Co-Founder) |
| Usage | `session.credits.available` / `balance` |
| Discover / referrals | static links to real routes |

No fake revenue, users, agents, or runtime metrics.

## 5. State-to-action mapping

Implemented in `lib/dashboard/view-model.ts` (`interpretProjectState`). Founder labels never expose raw state names (`plan_ready` → “Plan ready”, `build_failed` → “Build needs attention”).

Active project ranking: failures → action required → in-progress → recently completed → newest (`selectActiveProject`).

## 6. New routes/components created

- No new pages/routes
- `components/dashboard/dashboard-shell.tsx`
- `components/dashboard/command-center.tsx`
- `components/dashboard/dashboard-notifications.tsx`
- `lib/dashboard/view-model.ts` + tests
- `docs/DASHBOARD_REDESIGN_REPORT.md`

## 7. Existing components reused

`FirstMission`, `ActivationEmpty`, `CreditMeter`, `AccountMenu`, `ThemeToggle`, `VerifyEmailBanner`, `BrandLogo`, `useSession` / `useProjects` / `useProjectActivity`, button/skeleton/dropdown primitives.

## 8. Components removed from Home

`AppHeader`, `ProjectList`, `OnboardingChecklist`, `StartStrip` are no longer mounted on `/dashboard`. Files remain for other surfaces (`ProjectList` still exists; empty copy no longer says “first mirror”).

## 9. APIs reused

`/api/me`, `/api/projects`, `/api/projects/[id]/activity`. CreditMeter unchanged.

## 10. APIs added

None. No `/api/billing/overview`. No activity aggregation endpoint (N+1 avoided by querying the active project only).

## 11. Database changes

None.

## 12. Accessibility

- Semantic headings, `nav` labels, `sr-only` for icon-only controls
- Focus rings on sidebar, search, notifications, CTAs, mobile drawer
- Drawer is a dialog with close control; overlay click closes
- Notifications distinguish unread vs read (localStorage, not a second lifecycle)
- Color is not the only status cue (labels + copy)

Keyboard coverage should be verified in the browser (sidebar, switcher, bell, primary CTA, mobile menu).

## 13. Responsive

- Desktop: sidebar + multi-column
- `md` and below: hamburger + drawer
- Primary CTA stays in the next-action card
- No dedicated visual QA pass was run at 1440/768/390 in this session

## 14. Performance

- Reuses Zustand session/projects (no second store)
- Activity fetched only for the selected active project
- `useProjectActivity` skips empty ids; reads unwrapped `{ events }`
- Idle activity interval remains 60s; no `/status` polling on Home

## 15. Existing functionality verified (by contract, not E2E)

Preserved: First Mission (`?mission=1`, dismissed/completed), project create routes, Collaborate/build/deploy/runtime/billing/GitHub links, AccountMenu (admin stays in account menu). Dashboard does not auto-open Collaborate.

## 16. Known remaining limitations

- Authenticated pages outside `/dashboard` still use `AppHeader` (not the new shell)
- Notifications are derived from the active project + lifecycle, not a server inbox
- Runtime health is a link, not live metrics (no fake “Healthy”)
- Referral copy does not hardcode “2,000 credits”
- Typecheck/lint/full build should be run in CI; this report is from implementation + unit tests
- `OnboardingChecklist` / lobby `ProjectList` still exist for rollback; Home no longer uses them

## 17. Future-ready extension points

- Additional AI roles can append to `AiTeamCard` when real
- Business pulse / SDK / API usage sections omitted until contracts exist
- Notification storage key is isolated from the project state machine
