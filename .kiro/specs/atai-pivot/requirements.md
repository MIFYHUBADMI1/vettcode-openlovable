# Requirements Document

## Introduction

This document specifies the requirements for the **Atai Pivot** — a major product rebrand and repositioning of Atai into **Atai** (Advanced Technologies and AI Enterprises), available at [atai.ink](https://atai.ink). The pivot transforms the platform from a general-purpose AI app builder into a focused launch platform for non-technical founders, startup operators, and small business owners who want to launch production-ready SaaS and business applications with no coding knowledge required.

The pivot spans 8 areas: brand/identity, a new collaborative planning stage, subscription-first billing, a real theme system, a founder-focused onboarding flow, output quality improvements, a unified Atai SDK/API router, and a post-build business lifecycle control panel.

---

## Glossary

- **Atai**: The new brand name; full name "Advanced Technologies and AI Enterprises." The platform domain is atai.ink.
- **Atai_System**: The Atai platform as a whole — used in requirements where the platform itself acts.
- **Brand_Layer**: All user-facing text, metadata, OG tags, Schema.org markup, and legal pages.
- **Atai_Credits**: The renamed credit unit (previously "Atai Credits"); used as internal accounting only.
- **Pipeline_Mode**: User-selected build quality setting. "Atai Standard" (previously "Legacy") and "Atai Pro" (previously "Heavy").
- **Plan_Stage**: The new intermediate project lifecycle state and UI where founders review and refine their app plan with AI assistance before build starts.
- **Collaborate_Page**: The `/project/[projectId]/collaborate` two-panel UI for plan review and AI chat.
- **Plan_Chat_API**: The `POST /api/projects/[projectId]/plan-chat` endpoint backing the Collaborate_Page AI chat panel.
- **Launch_API**: The `POST /api/projects/[projectId]/launch` endpoint that triggers the build after plan confirmation.
- **Founder_Form**: The redesigned idea-mode project creation form with multi-field, business-language inputs.
- **Theme_System**: The real theme provider supporting system, dark, light, light-blue, and glass themes.
- **Onboarding_Dialog**: The 4-step founder-focused first-run dialog shown to new users.
- **Quality_Gate**: A second AI call after spec generation that reviews the spec against a production-readiness checklist and patches gaps.
- **Atai_SDK**: The `@atai/sdk` client library consumed by generated applications to call platform services.
- **Atai_API_Router**: The `app/api/atai/` route namespace that proxies service calls from generated apps to underlying providers.
- **Atai_API_Key**: A per-project API key (format `atai_proj_...`) used to authenticate SDK calls from generated apps.
- **Business_Overview_Tab**: A new workspace tab shown when a project is in `ready` or `deployed` state, surfacing business metrics.
- **Customer_Data_Tab**: The renamed "Database" tab, presented in plain business language.
- **Domain_SEO_Panel**: A top-level workspace panel for custom domain management, SSL status, and AI-assisted basic SEO editing.
- **Subscription_Plan**: One of six tiered plans — Free, Explorer, Launch, Growth, Scale, and Enterprise. Each paid plan has a discounted current price displayed alongside its original (strikethrough) price to communicate savings. All paid plans carry a Limited_Offer_Label.
- **Original_Price**: The full list price of a plan before the current promotional discount. Displayed with strikethrough style.
- **Discounted_Price**: The current promotional price the user actually pays. Displayed prominently.
- **Annual_Plan**: A yearly billing option for Explorer, Launch, Growth, and Scale. The annual total is calculated from the Discounted_Price with a free-months bonus applied: 2 free months for Explorer and Launch (user pays 10 months), 3 free months for Growth and Scale (user pays 9 months). The pricing page displays the annual total, the monthly-equivalent rate, and the total amount saved vs paying monthly at the Discounted_Price.
- **Limited_Offer_Label**: A visual badge applied to every paid plan card communicating that the discounted price is a limited-time promotional offer.
- **ProjectState**: The server-persisted lifecycle enum for a project (see `lib/types/project.ts`).
- **Totalum**: The underlying build engine and infrastructure provider (unchanged).
- **Firecrawl**: The web crawling service used in mirror/website mode (unchanged).

---

## Requirements

---

### Requirement 1 — Brand Identity Replacement

**User Story:** As a platform user, I want every visible reference to Atai replaced with Atai branding, so that the platform consistently reflects the new identity.

#### Acceptance Criteria

1. THE Brand_Layer SHALL display "Atai" wherever "Atai" or "Atai" previously appeared in user-facing text, page titles, headings, and navigation.
2. THE Brand_Layer SHALL display the tagline "Launch your business. No code required." on the homepage hero and in the default HTML `<title>` template.
3. THE Brand_Layer SHALL set the HTML `<meta name="description">` content to a founder-platform description that does not mention website mirroring or cloning as the primary value proposition.
4. THE Brand_Layer SHALL set the Open Graph `og:title`, `og:description`, `og:site_name`, Schema.org `name`, and Schema.org `description` fields to Atai-branded values.
5. THE Brand_Layer SHALL set the HTML `<title>` template to `"%s | Atai"` and the default title to `"Atai | Launch your business. No code required."`.
6. THE Atai_System SHALL render a logo component that displays the text "Atai" in the default foreground color. The platform domain "atai.ink" MAY appear as a secondary label beneath the logo but is not part of the primary logo mark.
7. THE Brand_Layer SHALL display the footer copyright notice as "© 2026 Atai — Advanced Technologies and AI Enterprises."
8. THE Atai_System SHALL use "Atai Credits" as the display name for the credit unit in all user-facing strings, replacing "Atai Credits."
9. THE Atai_System SHALL use "Atai Standard" as the display label for the legacy pipeline mode and "Atai Pro" for the heavy pipeline mode in all user-facing strings.
10. WHEN the Atai_System reads or writes a localStorage key that begins with the prefix `"Atai:"`, THE Atai_System SHALL use the equivalent key with the prefix `"atai:"` instead.
11. IF a user's browser contains a localStorage entry under a `"Atai:"` prefixed key, THEN THE Atai_System SHALL migrate that value to the corresponding `"atai:"` prefixed key on the next page load and remove the old key.
12. THE Brand_Layer SHALL replace "Atai" with "atai" (case-insensitively) in all legal page text, privacy policy, and terms of service documents that are part of the repository.

---

### Requirement 2 — Collaborative Plan Stage

**User Story:** As a non-technical founder, I want to review and refine my app plan in plain business language before the build starts, so that I can confirm the app matches my vision before credits are consumed.

#### Acceptance Criteria

1. THE Atai_System SHALL include `"plan_ready"` as a valid `ProjectState` value, inserted between `"specification_ready"` and `"awaiting_build_confirmation"` in the lifecycle sequence.
2. WHEN any pipeline (website, scratch/idea, GitHub clone, or GitHub extend) completes specification generation, THE Atai_System SHALL transition the project to `"plan_ready"` state instead of calling `autoLaunchBuild()` automatically.
3. WHEN a project transitions to `"plan_ready"` state, THE Atai_System SHALL NOT charge or reserve any build credits.
4. WHEN a user navigates to `/project/[projectId]/collaborate`, THE Atai_System SHALL render the Collaborate_Page with a left panel occupying 60% of the layout width and a right panel occupying 40% of the layout width.
5. THE Collaborate_Page left panel SHALL display the following sections, each written in plain business language with no technical jargon: what is being built, who the app is for, key features, how users will use the app, data the app manages, how users sign in, and any recorded project preferences.
6. THE Collaborate_Page right panel SHALL render an AI chat interface where the founder can send messages and receive responses.
7. WHEN a founder sends a message to the Plan_Chat_API at `POST /api/projects/[projectId]/plan-chat`, THE Plan_Chat_API SHALL return an AI-generated response relevant to the plan and update the project's specification and conversation record in the database.
8. THE Plan_Chat_API SHALL store each exchange (user message and AI response) in the project's `conversation` array with `role`, `content`, and `at` fields.
9. WHEN a founder clicks the "Submit Plan & Start Building" button on the Collaborate_Page, THE Atai_System SHALL call the Launch_API at `POST /api/projects/[projectId]/launch`.
10. WHEN the Launch_API receives a valid request for a project in `"plan_ready"` state, THE Launch_API SHALL call `autoLaunchBuild()` and transition the project to `"awaiting_build_confirmation"` or `"building"` state as appropriate.
11. THE Collaborate_Page SHALL be accessible to unauthenticated visitors if the project's `visibility` is `"public"`, and restricted to the owning user if `visibility` is `"private"`.
12. IF the Launch_API receives a request for a project that is not in `"plan_ready"` state, THEN THE Launch_API SHALL return an HTTP 409 response with a descriptive error message.

---

### Requirement 3 — Founder-Focused Idea Mode Form

**User Story:** As a non-technical founder, I want to describe my business idea through structured fields rather than a free-text box, so that the AI can generate a more accurate and relevant app plan.

#### Acceptance Criteria

1. THE Founder_Form SHALL replace the single idea textarea in the idea-mode project creation flow with five distinct input fields: Business/product name (optional text), The problem you are solving (textarea), Your target audience (text), The solution (textarea), and Business model (select).
2. THE Founder_Form business model select SHALL offer exactly these options: "SaaS subscription", "One-time purchase", "Marketplace / commission", "Free with paid upgrades", and "Other".
3. WHEN a founder submits the Founder_Form, THE Atai_System SHALL construct a combined `idea` string from all five fields and pass it to the scratch pipeline as it does today.
4. THE Founder_Form SHALL require the "problem" field and the "solution" field before submission is enabled; all other fields SHALL be optional.
5. WHEN the Atai_System constructs the combined idea string from Founder_Form fields, THE Atai_System SHALL include the business model value so that the specification generator and prompt builder can apply appropriate payment scaffolding.

---

### Requirement 4 — Subscription-First Billing

**User Story:** As a non-technical founder, I want to choose a plan based on what it lets me do and to clearly see how much I am saving, so that I understand the value without thinking in technical cost units.

#### Acceptance Criteria

1. THE Atai_System SHALL define six Subscription_Plans in `lib/billing/config.ts` with the identifiers `"free"`, `"explorer"`, `"launch"`, `"growth"`, `"scale"`, and `"enterprise"`.

2. THE Atai_System SHALL store both an `originalPriceUSD` (full list price) and a `discountedPriceUSD` (current promotional price) for each paid plan, with the following values:

   | Plan ID    | Original Price | Discounted Price |
   |------------|---------------|-----------------|
   | free       | $0            | $0              |
   | explorer   | $29.99/mo     | $20/mo          |
   | launch     | $129/mo       | $99/mo          |
   | growth     | $450/mo       | $399/mo         |
   | scale      | $689/mo       | $599/mo         |
   | enterprise | custom        | custom          |

3. THE Atai_System SHALL define the Free plan as including: 1 project, 1 build attempt, 30-day hosted trial, limited database, and community support.

4. THE Atai_System SHALL define the Explorer plan as including: 3 projects, 5 builds per month, full database management, custom domain, and standard support.

5. THE Atai_System SHALL define the Launch plan as including: 10 projects, unlimited builds, database with backups, payment integration, priority builds, and 2 team seats.

6. THE Atai_System SHALL define the Growth plan as including: 25 projects, unlimited builds, advanced database management, payment integration, priority builds, analytics, and 5 team seats.

7. THE Atai_System SHALL define the Scale plan as including: unlimited projects, unlimited builds, advanced database, dedicated infrastructure, 10 team seats, and direct support.

8. THE Atai_System SHALL define the Enterprise plan as including everything in Scale plus SLA-backed uptime, dedicated account manager, white-glove onboarding, and custom pricing confirmed via sales or support contact.

9. THE pricing page SHALL display the Discounted_Price as the primary price for each paid plan and SHALL display the Original_Price with a strikethrough style directly adjacent to it.

10. THE pricing page SHALL display a savings indicator on each paid plan card showing the exact monthly dollar amount saved (Original_Price minus Discounted_Price), e.g. "Save $9.99/mo".

11. THE pricing page SHALL display a Limited_Offer_Label badge on every paid plan card to communicate that the discounted price is a time-limited promotional offer.

12. THE pricing page SHALL provide a monthly / yearly billing toggle. When yearly billing is selected, the following Annual_Plan rules apply:
    - Explorer and Launch: user is charged for 10 months (2 months free); yearly total = Discounted_Price × 10.
    - Growth and Scale: user is charged for 9 months (3 months free); yearly total = Discounted_Price × 9.

13. WHEN yearly billing is selected on the pricing page, each paid plan card SHALL display all four of the following values:
    - The annual total in USD (e.g. "$200/yr").
    - The monthly-equivalent rate (annual total ÷ 12, rounded to two decimal places).
    - The number of free months included (e.g. "2 months free" or "3 months free").
    - The total annual saving vs paying monthly at the Discounted_Price (annual saving = (Discounted_Price × 12) minus annual total), e.g. "You save $40 a year".

14. THE pricing page SHALL display the yearly option as the recommended default selection when the page first loads, so that the annual savings are immediately visible to the user.

15. WHEN yearly billing is selected, THE pricing page SHALL also display to the user their total saving when combining both the promotional discount and the free-months bonus, e.g. "With this plan you save $X/mo from the list price, plus 2 months free — $Y total savings per year vs full price."

16. WHILE a user is authenticated and does not have an admin role, THE Atai_System SHALL NOT display a credit balance or credit count in the dashboard header or navigation.

17. WHILE a user is authenticated and does not have an admin role, THE Atai_System SHALL NOT display a credit cost label on any step of the project creation flow.

18. THE Atai_System SHALL export the existing six Atai subscription plans under a `DEPRECATED_SUBSCRIPTION_PLANS` export in `lib/billing/config.ts` so that existing subscribers on old plans retain correct plan resolution.

19. THE Atai_System SHALL continue to use Atai Credits as the internal accounting unit for cost tracking and billing reconciliation; the credit system SHALL remain intact in `lib/billing/`.

---

### Requirement 5 — Theme System

**User Story:** As a user, I want to choose a visual theme that matches my working environment, so that I can use the platform comfortably in different lighting conditions and preferences.

#### Acceptance Criteria

1. THE Theme_System SHALL support exactly five theme identifiers: `"system"`, `"dark"`, `"light"`, `"light-blue"`, and `"        The design theme you are thinking of is called Glassmorphism.It is a popular digital design style characterized by a translucent, frosted-glass effect where background elements look blurred through a glassy surface.Key Characteristics of GlassmorphismTransparency: Uses background blur to create a see-through effect.Layering: Elements appear to float on top of each other using subtle shadows.Vivid Colors: Works best on bright, colorful backgrounds to make the blur pop.Light Borders: Features thin, semi-transparent borders to mimic the edges of glass."`.
2. WHEN a user's active theme is `"system"`, THE Theme_System SHALL apply the `"dark"` CSS class to the root `<html>` element when the OS color scheme is dark and remove it when the OS color scheme is light.
3. WHEN a user's active theme is `"dark"`, THE Theme_System SHALL apply the `"dark"` CSS class to the root `<html>` element regardless of OS preference.
4. WHEN a user's active theme is `"light"` or `"light-blue"`, THE Theme_System SHALL remove the `"dark"` CSS class from the root `<html>` element.
5. WHEN a user's active theme is `"glass"`, THE Theme_System SHALL apply a `"theme-glass"` CSS class to the root `<html>` element, enabling translucent surface and backdrop-blur styles.
6. WHEN a user selects a theme in Settings → Appearance, THE Theme_System SHALL persist the selection to localStorage under the key `"atai:theme"`.
7. WHEN a user selects a theme and is authenticated, THE Theme_System SHALL save the theme preference to the user's database profile.
8. WHEN a page loads and the user is authenticated, THE Theme_System SHALL load the theme preference from the user's database profile; IF no profile preference exists, THE Theme_System SHALL fall back to the `"atai:theme"` localStorage value; IF neither exists, THE Theme_System SHALL default to `"system"`.
9. THE root `<html>` element SHALL NOT have a hardcoded `class="dark"` attribute; theme class application SHALL be managed exclusively by the Theme_System.
10. THE root `<html>` element SHALL carry the `suppressHydrationWarning` attribute to prevent React hydration mismatches from server-rendered theme classes.
11. THE Theme_System SHALL replace the existing no-op `ThemeProvider` component with a functional implementation that fulfills criteria 1–8 above.

---

### Requirement 6 — Founder-Focused Onboarding

**User Story:** As a new user, I want an onboarding experience tailored to launching a business, so that I am oriented toward the platform's value and guided to the right starting point for my situation.

#### Acceptance Criteria

1. THE Onboarding_Dialog SHALL present exactly 4 steps, tracked with a visible progress indicator.
2. THE Onboarding_Dialog Step 1 SHALL display the heading "Welcome to Atai" and contain a textarea asking the user to describe their business in 1–2 sentences.
3. THE Onboarding_Dialog Step 2 SHALL ask "What best describes your role?" and offer exactly these role options: Founder, Co-Founder, Business Owner, Startup Operator, Product Manager, and Other.
4. WHEN a user selects "Other" in Step 2, THE Onboarding_Dialog SHALL reveal a text input for free-form role entry.
5. THE Onboarding_Dialog Step 3 SHALL ask "Where are you in the process?" and offer exactly these options: "I have an idea" (routes to idea mode), "I have a competitor to build on" (routes to mirror mode), "I have an existing codebase" (routes to GitHub mode), and "Not sure yet" (routes to dashboard).
6. THE Onboarding_Dialog Step 4 SHALL display an embedded or linked video introduction, with the video URL sourced from a configurable environment variable or application constant.
7. THE Onboarding_Dialog Step 4 SHALL provide exactly two action buttons: "Watch later" (dismisses the dialog and routes to the destination selected in Step 3) and "I'm ready — let's build" (dismisses the dialog and routes to the destination selected in Step 3).
8. WHEN a user completes or skips the Onboarding_Dialog, THE Atai_System SHALL persist completion status to localStorage under the key `"atai:onboarded"` and, if the user is authenticated, save completion to their database profile.
9. WHEN the Atai_System detects an existing `"Atai:onboarded"` key in localStorage, THE Atai_System SHALL treat the user as already onboarded and SHALL NOT show the Onboarding_Dialog again.
10. THE Onboarding_Dialog SHALL include a checklist in a sidebar or below the step content showing four milestone steps: "Tell us about your business", "Collaborate on your app plan", "Launch your first build", and "Go live — deploy to your domain."

---

### Requirement 7 — Output Quality Gate

**User Story:** As a founder, I want every generated application to be immediately launchable and production-ready, so that I do not need to manually improve the output before showing it to real users.

#### Acceptance Criteria

1. WHEN specification generation completes for any pipeline mode, THE Quality_Gate SHALL execute a second AI call that reviews the generated specification against a production-readiness checklist.
2. THE Quality_Gate production-readiness checklist SHALL include all of the following items: user authentication, database CRUD operations, responsive design, SEO-ready page titles and meta descriptions, proper error pages (404 and 500), a basic admin dashboard for the business owner, and payment processing scaffolding when the project's business model is not empty.
3. WHEN the Quality_Gate identifies a missing or incomplete checklist item, THE Quality_Gate SHALL either patch the specification directly or append a corrective instruction to the specification's `additionalInstructions` field.
4. THE Atai_System build prompt SHALL always include the following instruction: "This application must be immediately launchable for a real business. Include: user authentication, database CRUD operations, responsive design, SEO-ready page titles and meta tags, proper error pages (404, 500), a fundatonal and advanced complete admin dashboard that handles everything like payments,usrs,ai configurations if the application uses or is supposed to use ai or uses ai anywhere,autheciation configurations and many others for the business owner to manage their data, and payment processing scaffolding if the app has a business model."
5. THE Atai_System build prompt SHALL always include an instruction to generate sensible seed data so the application is immediately demonstrable after the first build.
6. THE Atai_System build prompt SHALL always include an instruction to implement production-quality error handling, loading states, and empty states throughout the application.
7. WHEN the project's `preferences.additionalNotes` or the combined idea string contains a non-empty business model value, THE Atai_System build prompt SHALL include an instruction to scaffold payment integration appropriate for that business model.
8. THE Atai_System SHALL use a production-grade AI model via OpenRouter for specification generation and planning; acceptable models are `anthropic/claude-3.5-sonnet`, `anthropic/claude-3-opus`, or `openai/gpt-4o`.

---

### Requirement 8 — Atai SDK and Unified API Router

**User Story:** As a developer of a generated application, I want a single SDK that handles all service integrations, so that generated apps do not need to configure multiple provider API keys directly.

#### Acceptance Criteria

1. THE Atai_System SHALL generate an `ataiApiKey` of the format `atai_proj_` followed by a URL-safe random identifier at the time a new project is created and store it on the project record.
2. WHEN a project is launched and a Totalum build is started, THE Atai_System SHALL inject the project's `ataiApiKey` as the `ATAI_API_KEY` environment variable into the Totalum project configuration.
3. THE Atai_API_Router SHALL expose the following route namespaces under `app/api/atai/`: `payments/` (proxying to Dodo Payments), `ai/` (proxying to OpenRouter), `ai/voice/` (proxying to OpenRAPS), `auth/` (proxying to the platform's auth system), `email/` (proxying to Resend), `storage/` (proxying to R2/S3), `notify/` (proxying to Twilio/Vonage), `analytics/` (proxying to PostHog), and `search/` (proxying to Algolia/Meilisearch).
4. WHEN the Atai_API_Router receives a request, THE Atai_API_Router SHALL authenticate the request by reading the `x-atai-key` header value and validating it against the stored `ataiApiKey` for the matching project in the database.
5. IF the Atai_API_Router receives a request with an invalid or missing `x-atai-key` header, THEN THE Atai_API_Router SHALL return an HTTP 401 response.
6. THE Atai_API_Router SHALL enforce per-plan rate limits on the authenticated project; IF a request exceeds the plan's rate limit, THEN THE Atai_API_Router SHALL return an HTTP 429 response.
7. THE Atai_SDK SHALL provide a client class named `Atai` with at minimum the following namespaced methods available in the first rollout phase: `atai.payments.createCheckout(options)` and `atai.ai.chat(options)`.
8. THE Atai_SDK `payments.createCheckout` method SHALL accept at minimum `amount` (number, in cents) and `currency` (string) parameters and proxy the request to the `payments/` route of the Atai_API_Router.
9. THE Atai_SDK `ai.chat` method SHALL accept at minimum `model` (string) and `messages` (array) parameters and proxy the request to the `ai/` route of the Atai_API_Router.
10. THE Atai_System build prompt SHALL instruct the build engine to use `@atai/sdk` for all payment, AI chat, email, and notification operations within generated applications.
11. WHERE a generated project has a non-empty business model (i.e., is monetised), THE Atai_System SHALL configure the `payments/` proxy route for that project with the appropriate Dodo Payments credentials at build time.

---

### Requirement 9 — Business Lifecycle Management

**User Story:** As a non-technical founder, I want my project workspace to become a business control panel after the build completes, so that I can monitor and manage my live application without needing developer tools.

#### Acceptance Criteria

1. WHEN a project is in `"ready"` or `"deployed"` state, THE Atai_System SHALL display the Business_Overview_Tab as the default active tab in the project workspace.
2. THE Business_Overview_Tab SHALL display the following metrics: total users registered in the application, revenue summary sourced from Dodo Payments for that project, active subscriptions count, last deployment date and status, and application health check result.
3. WHEN the Business_Overview_Tab is displayed, THE Atai_System SHALL perform a health check by sending an HTTP GET request to the project's `developmentUrl` or `productionUrl` and SHALL display the response time in milliseconds and whether the application responded successfully.
4. THE Customer_Data_Tab SHALL replace the "Database" label with "Customer Data" in the workspace tab navigation.
5. THE Customer_Data_Tab default view SHALL display the key database tables (at minimum: Users and Orders if they exist in the schema) with a record count for each table.
6. THE Customer_Data_Tab SHALL provide an "Export to CSV" action for any displayed table.
7. THE Customer_Data_Tab SHALL provide a search input that filters records within the currently viewed table.
8. THE Domain_SEO_Panel SHALL be accessible as a top-level panel in the project workspace and SHALL NOT be buried inside a settings submenu.
9. THE Domain_SEO_Panel SHALL display: the custom domain field with current status, SSL certificate status (active or pending), and an AI-assisted SEO edit section containing editable fields for page title, meta description, and OG image URL.
10. WHEN a founder submits an SEO edit via the Domain_SEO_Panel, THE Atai_System SHALL construct an AI edit instruction and apply it to the project's deployed build.

---

### Requirement 10 — Backward Compatibility and Preservation

**User Story:** As an existing Atai user, I want my existing projects, subscriptions, and data to continue working after the rebrand, so that the pivot does not break anything I rely on today.

#### Acceptance Criteria

1. THE Atai_System SHALL retain all existing `ProjectState` values and their semantics; the new `"plan_ready"` state SHALL be additive only.
2. THE Atai_System SHALL continue to invoke Totalum for all code generation and infrastructure provisioning without any change to the integration contract.
3. THE Atai_System SHALL continue to invoke Firecrawl for website crawling in mirror/website mode without any change to the integration contract.
4. THE Atai_System SHALL preserve all functionality of the existing database management viewer under the Customer_Data_Tab rename.
5. THE Atai_System SHALL preserve GitHub push/export, version history, code recovery, the admin panel, the /explore gallery, and the referral system without modification.
6. THE Atai_System SHALL continue to process Dodo Payments webhooks and billing events correctly for existing subscribers on deprecated plans.
7. WHEN resolving a subscription for a user on a deprecated plan, THE Atai_System SHALL use the `DEPRECATED_SUBSCRIPTION_PLANS` export to determine the user's entitlements.
8. THE Atai_System SHALL preserve the MongoDB data layer and custom auth system without alteration.
