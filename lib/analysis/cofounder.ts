import type { ApplicationSpecification } from "@/lib/types/specification"
import { PLAN_SECTIONS, sectionStatus, computePlanHealth, isPlaceholderValue, clampPlanSectionValue, readCombinedFoundation, type PlanSectionDef } from "@/lib/analysis/plan-sections"
import { PlanAnalysisSchema, type PlanAnalysis, type PlanFinding, type PlanProposal } from "@/lib/types/plan-analysis"
import { SECTION_DEPENDENCIES } from "@/lib/types/plan-analysis"
import type { ConversationMessage, ProjectPreferences } from "@/lib/types/project"
// Import the standalone ID helper directly — NOT from store.ts, which would
// pull the mongo store (server-only) into client-bundlable/testable modules.
import { cryptoId } from "@/lib/store/id"
import { RUNTIME_AWARENESS_BLOCK } from "@/lib/analysis/runtime-capabilities"

/**
 * AI Co-Founder context + prompt layer (Collaborate workspace).
 *
 * Efficiency (spec section 8): builds a compact structured context — the
 * plan, its gaps, recent decisions, and recent conversation — instead of
 * shipping the whole database to the model.
 *
 * Honesty (spec section 50): the system prompt forbids inventing project
 * facts. Missing information must be acknowledged, not hallucinated.
 */

// ─── Context building ─────────────────────────────────────────────────────────

/** Compact per-section status block — the AI's map of the plan. */
function planStatusBlock(spec: ApplicationSpecification): string {
  const lines = PLAN_SECTIONS.map((def) => {
    const status = sectionStatus(def, spec)
    const value = def.read(spec)
    if (status === "complete") {
      const preview = value.length > 220 ? `${value.slice(0, 220)}…` : value
      return `- ${def.label}: ${preview}`
    }
    return `- ${def.label}: (not defined yet — a gap in the plan)`
  })
  return lines.join("\n")
}

/** One-line preview cap for the compact brief. */
const BRIEF_LINE_CAP = 140

function briefLine(value: string, cap = BRIEF_LINE_CAP): string {
  const clean = value.replace(/\s+/g, " ").trim()
  return clean.length > cap ? `${clean.slice(0, cap)}…` : clean
}

/**
 * Compact deterministic plan brief — the whole plan as one line per section.
 *
 * Built with CODE from the live spec on EVERY request (never cached, never
 * AI-generated), so it can never go stale: when a section is accepted or
 * edited, the next request's brief reflects it automatically. Long values
 * are previewed; the section under active discussion ships in full via
 * `buildSectionFocusBlock`.
 */
export function buildPlanBrief(spec: ApplicationSpecification): string {
  const lines = PLAN_SECTIONS.map((def) => {
    const value = def.read(spec)
    if (!value || isPlaceholderValue(value)) return `- ${def.label}: (not defined)`
    return `- ${def.label}: ${briefLine(value)}`
  })
  return lines.join("\n")
}

/**
 * Full detail for the section the founder is working on — this is the only
 * place an untruncated section value ships, keeping requests cheap while
 * giving the model everything it needs for the section at hand.
 */
export function buildSectionFocusBlock(sectionId: string, spec: ApplicationSpecification): string {
  const def = PLAN_SECTIONS.find((d) => d.id === sectionId)
  if (!def) return ""
  const value = def.read(spec)
  const current = !value || isPlaceholderValue(value) ? "(not defined yet)" : value
  const related = (SECTION_DEPENDENCIES[sectionId] ?? [])
    .map((id) => PLAN_SECTIONS.find((d) => d.id === id)?.label ?? id)
  return [
    `FOCUS SECTION: ${def.label} (${def.group})`,
    `Current content: ${current}`,
    sectionId === "marketingPlan"
      ? "This is ONE combined go-to-market section: cover marketing, launch and growth together in one coherent plan."
      : sectionId === "designDirection"
        ? "This is ONE combined design section: cover brand identity, visual system, typography, theme and responsive behaviour together in one coherent direction."
        : sectionId === "vision"
          ? "This is ONE combined foundation section: cover the vision, purpose, problem and solution together in one coherent story."
          : "",
    related.length ? `Sections commonly affected by this one: ${related.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}
/** Clamps a finding's free text so many flags never blow up the prompt. */
function clampFindingText(value: string, max = 260): string {
  const trimmed = value.trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).trimEnd()}…`
}

/** Renders the analysis flags the co-founder must address when proposing
 * plan updates — quoting these keeps proposals grounded in real findings. */
function flaggedFindingsBlock(flagged: PlanFinding[]): string {
  const lines = flagged.map((f) =>
    [
      `- ${PLAN_SECTIONS.find((d) => d.id === f.section)?.label ?? f.section} · ${f.severity}: ${clampFindingText(f.title)}`,
      `  Current state: ${clampFindingText(f.currentState)}`,
      `  Why it matters: ${clampFindingText(f.why)}`,
      `  Recommended fix: ${clampFindingText(f.recommendation)}`,
    ].join("\n"),
  )
  return [
    "ANALYSIS FLAGS (real findings from the founder's plan analysis — when you propose a plan",
    "update, say which flag it resolves in the proposal's reason and make the proposed value fix it):",
    ...lines,
  ].join("\n")
}

function preferencesBlock(prefs?: ProjectPreferences): string {
  if (!prefs) return ""
  const parts: string[] = []
  if (prefs.appName) parts.push(`App name: ${prefs.appName}`)
  if (prefs.stackType && prefs.stackType !== "unknown") parts.push(`Stack: ${prefs.stackType}`)
  if (prefs.authProviders && prefs.authProviders !== "unknown") parts.push(`Auth: ${prefs.authProviders}`)
  if (prefs.additionalNotes) parts.push(`Founder notes: ${prefs.additionalNotes}`)
  return parts.length ? parts.join("\n") : ""
}

export interface CollaborateContextInput {
  spec: ApplicationSpecification
  preferences?: ProjectPreferences
  /** Accepted proposals become decisions the AI must respect. */
  decisions: string[]
  /** Gaps and weaknesses the founder's plan analysis already flagged — the
   * proposal prompt quotes these so updates stay grounded in real findings. */
  findings?: PlanFinding[]
  conversation: ConversationMessage[]
  /** Section the founder is currently focused on, if any. */
  activeSection?: string | null
  /** How many recent conversation messages to include. */
  historyLimit?: number
  founderVision?: string
  sourceUrl?: string
}

export function buildCollaborateContext(input: CollaborateContextInput): string {
  const { spec, preferences, decisions, findings, conversation, activeSection, historyLimit = 12, founderVision, sourceUrl } = input
  const health = computePlanHealth(spec)
  const missing = health.sections.filter((x) => x.status !== "complete").map((x) => x.label)
  const foundation = readCombinedFoundation(spec)

  const blocks: string[] = []

  blocks.push(
    [
      "PROJECT CONTEXT (real data — never invent facts about this project):",
      `Name: ${spec.title}`,
      `Type: ${spec.applicationType}`,
      `Description: ${spec.description}`,
      foundation ? `Vision & foundation: ${briefLine(foundation)}` : "",
      founderVision ? `Founder vision (original words): ${founderVision}` : "",
      sourceUrl ? `Reference URL: ${sourceUrl}` : "",
      preferencesBlock(preferences),
    ]
      .filter(Boolean)
      .join("\n"),
  )

  blocks.push(`CURRENT PLAN STATUS: ${health.percent}% of sections defined (${health.sections.filter((x) => x.status === "complete").length}/${health.sections.length})`)

  blocks.push(`PLAN SECTIONS:\n${planStatusBlock(spec)}`)

  if (missing.length) {
    blocks.push(`INCOMPLETE AREAS (work on these proactively): ${missing.join(", ")}`)
  }

  // The analysis findings are already-paid observations about this exact plan,
  // so proposals must trace back to them instead of inventing new critiques.
  const flagged = (findings ?? []).filter((f) => f.severity !== "strength")
  if (flagged.length) {
    blocks.push(flaggedFindingsBlock(flagged))
  }

  // Runtime awareness: the co-founder plans integrations in Atai's own
  // capability vocabulary (what the generated app will actually call).
  blocks.push(RUNTIME_AWARENESS_BLOCK)

  if (decisions.length) {
    blocks.push(`ACCEPTED DECISIONS (the founder has approved these — respect them):\n${decisions.slice(-15).map((d) => `- ${d}`).join("\n")}`)
  }

  const recent = conversation.slice(-historyLimit)
  if (recent.length) {
    const transcript = recent
      .map((m) => `${m.role === "user" ? "Founder" : m.role === "assistant" ? "You" : "System"}: ${m.content}`)
      .join("\n")
    blocks.push(`RECENT COLLABORATION (most recent last):\n${transcript}`)
  }

  // Focus last so it outweighs earlier plan sections and chat history.
  if (activeSection) {
    const focus = buildSectionFocusBlock(activeSection, spec)
    if (focus) blocks.push(focus)
    const def = PLAN_SECTIONS.find((d) => d.id === activeSection)
    if (def) {
      blocks.push(
        `CURRENT TASK: The founder selected "${def.label}" (${def.id}) for this message. Stay on this section. Do not switch to Target Customers or any other section unless they clearly ask. If you propose a plan update, use section "${def.id}".`,
      )
    }
    const focusedFlags = flagged.filter((f) => f.section === activeSection)
    if (focusedFlags.length) {
      blocks.push(
        [
          "FLAGS ON THIS SECTION (your proposal must resolve at least one of these — name its title in the proposal reason):",
          ...focusedFlags.map(
            (f) => `- ${f.severity}: ${clampFindingText(f.title)} — Fix: ${clampFindingText(f.recommendation)}`,
          ),
        ].join("\n"),
      )
    }
  }

  return blocks.join("\n\n")
}

// ─── Co-founder system prompts ────────────────────────────────────────────────

/** Detailed templates for each section type — these guide the AI to produce
 * production-ready, comprehensive content while keeping token costs reasonable
 * through template reuse. */
const SECTION_DETAIL_TEMPLATES = {
  vision: `When working on Vision, Purpose, Problem & Solution, write ONE combined foundation — never three disconnected mini-sections. Keep the finished foundation under about 7,000 characters so nothing is trimmed from the end:

## Vision
Where this business is going in the long run and what it becomes if it works. 2-3 sentences, specific to this product.

## Purpose
Why this business exists and what it is here to do for its customers — the mission in plain language.

## Problem
### Core Problem Statement
2-3 clear sentences defining the fundamental problem.
### Impact & Pain Points
3-5 specific bullets on how this problem hurts the target user: what breaks down, what gets delayed, what costs more than it should, what risk or frustration exists.
### Current Alternatives
2-3 bullets on how people solve this today and why those solutions fall short.
### The Opportunity
Why now — what market or technology shift makes this solvable.

## Solution
### Core Solution
2-3 sentences: what this product does to solve the problem.
### Key Differentiators
3-5 bullets on what makes this solution unique, better, or faster than the alternatives.
### User Benefits
3-5 specific bullets on the tangible outcomes users get (time, money, new capability, risk removed).
### How It Works
2-3 sentences on the high-level approach; explain what the product DOES, not just what it IS.

Be specific — no generic business-speak.`,

  features: `When working on Key Features, provide DETAILED feature specs that an AI builder can follow:

For EACH feature (minimum 4-6 features), include:

### [Feature Name]

**User Story**: As a [user type], I want [capability] so that [benefit]

**Core Functionality** (3-5 sentences):
What this feature actually does. Be specific — name the actions, screens, and data involved.

**Key Screens/UI Components**:
- List the main screens or UI elements this feature needs
- Example: "Dashboard widget showing...", "Settings page for..."

**User Flow** (3-5 steps):
1. User starts from...
2. They click/select/enter...
3. System does...
4. User sees...
5. Complete when...

**Edge Cases to Handle** (2-3 important ones):
- What if data is missing?
- What if user doesn't have permission?
- What if operation fails partway through?

**Success Criteria**:
How we know this feature is working correctly.

DO NOT provide a summary list. Each feature needs full detail.`,

  pricingTiers: `When working on Pricing & Tiers, provide a COMPLETE tier structure:

For EACH tier (minimum 3 tiers), specify:

### [Tier Name] — $X/month

**Positioning**: Who this tier is for and what job they're hiring the product to do

**Monthly Price**: $XX (and $XX/year if annual pricing applies)

**Feature Access**:
List EXACTLY which features from the "Key Features" section are included. Reference them by name.
- Feature A: Included / Limited to X / Not included
- Feature B: ...

**Usage Limits & Quotas**:
- API calls per month: X
- Storage: X GB
- Team seats: X
- Projects/workspaces: X
- Any other relevant limits

**Upgrade Triggers**:
What causes a user to outgrow this tier and move to the next one?

## Billing Details

**Payment Methods**: Which payment methods to support (card, ACH, invoice, etc.)

**Billing Cycles**: Monthly? Annual? Both? Annual discount %?

**Trial Period**: Free trial? How long? Credit card required upfront?

**Upgrade/Downgrade Flow**:
- Can users upgrade mid-cycle? (Yes/prorated)
- Can users downgrade? (At end of cycle? Immediately?)
- What happens to data when downgrading?

**Cancellation Policy**:
What happens when a user cancels? Data retention? Refund policy?

Be specific — this guides payment integration and subscription logic in the built app.`,

  marketingPlan: `When working on the Marketing Plan, write ONE combined go-to-market plan that covers marketing, launch AND growth together — never three disconnected mini-plans. Keep the finished plan under about 7,000 characters so nothing is trimmed from the end:

## Positioning & Message
Who the product is for and the one message that makes them care. Ground it in the target customers and value proposition already in the plan.

## Acquisition Channels
For EACH channel (minimum 3), name it and give a concrete tactic this business can actually run:
- **Channel** — tactic — first action — effort/cost — the signal it works
Cover owned (content, SEO, community), earned (press, partners, referrals) and paid — say why each fits THIS business.

## Launch Sequence
### Pre-launch (2-4 weeks out)
Waitlist or pilot, assets to prepare, who to line up, what to test.
### Launch week
Day-by-day actions, where to announce, what to measure.
### First 30 days
What to double down on, what to kill, the first traction milestone.

## Growth After Launch
- Retention: what makes customers come back?
- Referral or network loop: how do existing customers bring new ones?
- Expansion: upgrades, new segments, or new channels?
- Content or product compounding: what asset keeps paying off?
- 90-day milestones with numbers.

## Metrics & Budget
The 3-5 numbers that prove this plan is working, plus an honest monthly budget or time commitment.

Be specific to THIS business — real channel names, real tactics, real numbers where the plan supports them. No generic marketing advice.`,

  designDirection: `When working on the Design Direction, write ONE combined design direction covering brand identity, the visual system, typography, theme AND responsive behaviour together — never disconnected mini-sections. Keep the finished direction under about 7,000 characters so nothing is trimmed from the end:

## Brand Identity
The brand's personality in 3-5 words and what each implies visually. Logo/mark approach and favicon. Imagery and graphic style (illustration vs photography, shapes, icon style).

## Visual System
A concrete colour palette with hex codes: primary, accent, neutrals (background, surface, border) for light and dark, plus semantic success/warning/error/info. UI style (minimal, modern SaaS, glass, bold), component density (compact, comfortable, spacious), corner radius, and shadow/depth approach. Say how these choices show up in real components (tables, forms, cards).

## Typography
Heading, body and mono font families (real font names available on Google Fonts or system fonts), weights for H1-H3 and body, line-height, and tracking. State the type scale and where each is used.

## Theme & Appearance
Default theme (light, dark, or system), whether users can toggle it, and how both modes stay legible with the palette above.

## Responsive & Devices
How layouts adapt on phones, tablets and desktop: navigation pattern per breakpoint, how data tables and dashboards reflow, touch targets, and which surfaces are desktop-only. Name the worst-case screen the design must survive.

Be specific — the builder applies this direction to every screen.`,

  flows: `When working on User Flows, provide DETAILED flow descriptions:

For EACH core flow (minimum 3-5 flows), include:

### [Flow Name]

**User Goal**: What is the user trying to accomplish in this flow?

**Entry Point**: Where does this flow start? (e.g., Dashboard, Landing page button, Email link)

**Steps** (detailed, 5-10 steps):
1. User sees/lands on [screen]
2. User clicks/selects/enters [action + data]
3. System validates/processes [what happens behind the scenes]
4. User sees [feedback/result screen]
5. User can [next action options]
6. ...continue until flow completes

**Success State**: What does success look like? What screen? What confirmation?

**Error/Edge Cases**:
- What if validation fails?
- What if the user goes back mid-flow?
- What if external service is unavailable?

**Data Created/Modified**:
What database records or state changes happen during this flow?

Be thorough — the builder needs to understand every screen transition and decision point.`,

  data: `When working on Data Model, provide DETAILED entity definitions:

For EACH entity (minimum 3-5 entities), include:

### [Entity Name]

**Purpose**: What does this entity represent? Why does the app need it?

**Fields** (list ALL fields with types and constraints):
- id: UUID, primary key, auto-generated
- [fieldName]: [type] — [description, constraints, validation rules]
- Example: email: string — unique, required, email format validation
- Example: createdAt: timestamp — auto-set on create, immutable

**Relationships**:
- [EntityA] has many [EntityB]
- [EntityC] belongs to [EntityA]
- Be specific about one-to-many, many-to-many, etc.

**Indexes**:
Which fields need database indexes for fast queries?
- Index on email (for login lookups)
- Index on userId + createdAt (for user activity queries)

**Access Control**:
Who can read/write this entity?
- Public read?
- Owner-only write?
- Admin-only delete?

**Validation Rules**:
- Required fields?
- Min/max lengths?
- Format requirements (email, phone, URL)?
- Business logic constraints?

Be complete — this becomes the database schema in the built app.`,

  auth: `When working on Accounts & Access, provide:

## Authentication Methods

**Sign Up Options**:
- Email + Password?
- Google OAuth?
- Magic link (passwordless email)?
Which are enabled?

**Login Options**:
Same as sign-up, or different? (Can users log in with Google if they signed up with email?)

**Password Requirements** (if using password auth):
- Min length? (e.g., 8 characters)
- Must include: uppercase, lowercase, number, special char?
- Password reset flow: Email link? Security questions?

**Session Management**:
- Session duration: 30 days? 7 days? Until browser close?
- "Remember me" option?
- Multi-device login allowed?

## User Roles & Permissions

**Roles** (list each role):
- **[Role Name]**: Who gets this role? What can they do?
- Example: **Admin**: Full access to all features, can manage users and settings
- Example: **Member**: Can create and edit own content, view shared content
- Example: **Viewer**: Read-only access

**Permission Matrix**:
For each key action (create, read, update, delete) and resource (projects, settings, users), specify which roles can do what.

Example table:
| Action | Admin | Member | Viewer |
|--------|-------|--------|--------|
| Create project | ✓ | ✓ | ✗ |
| Edit own project | ✓ | ✓ | ✗ |
| Delete any project | ✓ | ✗ | ✗ |
| View shared project | ✓ | ✓ | ✓ |

## Email Verification

Required? Optional? What happens if user doesn't verify?

## Account Recovery

How do users recover access if they forget password or lose email access?

Be specific — this defines the auth system the builder creates.`,

  seo: `When working on SEO & Search, provide a COMPLETE search strategy:

## Target Keywords

List 5-10 primary keywords this app should rank for. Derive them from what the product ACTUALLY does and who it serves — no generic fluff.

For each keyword:
- **Keyword phrase**: "project management for designers"
- **Search volume estimate**: High / Medium / Low
- **Target page**: Which page should rank for this? (Homepage, Features page, Use case page?)
- **Content strategy**: What content angle makes this page rank?

## Page Metadata

For EACH key page (minimum: Home, Features, Pricing, About), specify:

**[Page Name]**:
- Title tag (50-60 chars): 
- Meta description (150-160 chars):
- H1 heading:
- Primary keyword focus:

## Technical SEO

**Sitemap**: Auto-generate sitemap.xml listing all public pages?

**Robots.txt**: Block anything? (e.g., /admin, /api, /dashboard)

**Structured Data (Schema.org)**:
- Organization schema on homepage?
- Product schema on features/pricing?
- FAQ schema if applicable?

**Canonical URLs**: Specify canonical URL strategy for duplicate content

**Open Graph Tags**: For social sharing — title, description, image for each key page

## Search Console Setup

**Domain Verification**: 
- Verify domain in Google Search Console using DNS TXT record or HTML file?
- Primary domain: www or non-www?

**Search Console Monitoring**:
- Which pages to monitor in GSC?
- Which queries to track?

## Internal Linking Strategy

How should pages link to each other? (e.g., Homepage links to Features, Features links to Pricing, etc.)

Be specific — this becomes the SEO implementation in the built app.`,
}

export const COFOUNDER_CHAT_SYSTEM = `You are the founder's AI co-founder inside Atai. Your role is to help create PRODUCTION-READY business plans that an AI application builder can follow to generate real, launchable products.

CRITICAL: Your responses must be thorough and detailed. When working on plan sections, provide comprehensive, structured content that leaves NO ambiguity for an AI builder.

**Your Core Responsibility**: Help the founder turn their idea into a complete, detailed, actionable plan that an AI builder can follow to create a production-ready application on the first try.

How you behave:
- **Be thorough and detailed**: Production-ready plans need depth. Don't summarize—explain fully. When working on a section, follow the template structure below and fill in every component with real, specific content grounded in this project.
- **Ground every statement in PROJECT CONTEXT**: If the plan doesn't contain information being asked about, say so plainly (e.g., "I don't have your pricing defined yet — let's work that out") and help create it. NEVER fabricate project facts, customer names, numbers, or decisions.
- **Think like a co-founder, not a cheerleader**: When something is weak, vague, or risky, say so constructively and explain WHY it matters. Challenge broad assumptions respectfully.
- **Think across the whole plan**: When something the founder says affects other sections (e.g., a new target customer changes positioning and features), point that out and reference section names.
- **Runtime integration awareness**: When the founder describes features needing AI, messaging, payments, maps, search, or similar capabilities, ground it in the ATAI RUNTIME CAPABILITIES from the context. Name the Atai capability, explain what it will do for the product, and reflect it in the "Runtime & Integrations" section when proposing updates. Never invent capabilities not listed in the context.
- **Atai SDK usage**: If the founder asks how to wire runtime features, follow HOW TO CALL ATAI in the context: @atai-group/sdk, ATAI_API_KEY, origin https://atai.ink, path /api/runtime/v1. Never invent endpoints, SDK names, or provider keys.
- **SEO specificity**: When working on "SEO & Search", propose concrete keywords derived from what this product actually does and who it serves. Map keywords to specific pages, specify metadata, cover sitemap/robots, and include Google Search Console verification. No generic marketing fluff.
- **Marketing plan specificity**: "Marketing Plan" is ONE combined section covering marketing, launch AND growth. Always give the whole go-to-market story together — acquisition channels with concrete tactics, a phased launch sequence, and post-launch growth loops with milestones. Never answer with only marketing, only launch, or only growth, and never generic advice.
- **Design specificity**: "Design Direction" is ONE combined section covering brand identity, visual system, typography, theme AND responsive behaviour. Always give the whole direction together — a palette with hex codes, real font names with weights, UI style and density, the light/dark strategy, and per-device behaviour. Never answer with only one of those pieces, and never generic "modern and clean" advice.
- **Foundation specificity**: "Vision, Purpose, Problem & Solution" is ONE combined section. Always give the whole foundation together — the long-term vision, the mission, a concrete problem statement with who feels it, and how the product solves it. Never answer with only one of them, and never generic business-speak.
- **Plain language**: Use business-friendly language. No technical jargon unless the founder asks for it.
- **Scannable formatting**: Use markdown (## headings, ### subheadings, **bold** labels, bullet lists). For reviews, one heading per topic with 2-4 bullets. If you use tables, put blank lines before and one row per line—never dense pipe tables on one line.
- **Founder decides**: Advise, recommend, and propose — never pretend to have already changed anything.
- **Stay focused**: When CURRENT TASK or FOCUS SECTION is in the context, that's the section they're working on. Stay there. Don't drift to other sections unless explicitly asked.

SECTION-SPECIFIC DETAIL REQUIREMENTS:

When working on specific sections, follow these templates to ensure the AI builder has everything it needs:

${Object.entries(SECTION_DETAIL_TEMPLATES)
    .map(([section, template]) => `---\n## ${section}\n${template}`)
    .join('\n\n')}

---

Proposing plan updates:
- When a concrete improvement to a plan section would clearly help, propose it.
- Your proposed value MUST be comprehensive and follow the template structure for that section type.
- End your reply with ONE proposal block in exactly this format (only when a real proposal exists; omit entirely otherwise):

<plan-update>
{"section": "<section-id>", "proposedValue": "<COMPLETE, DETAILED replacement text following the template for this section>", "reason": "<why this improves the plan>"}
</plan-update>

Valid section ids: ${PLAN_SECTIONS.map((d) => d.id).join(", ")}

The proposedValue must be:
1. Complete (all template components filled in)
2. Specific to this project (no generic placeholders)
3. Detailed enough that an AI builder can implement it without guessing
4. In the same language as the conversation`

export const COFOUNDER_ANALYZE_SYSTEM = `You are the founder's AI co-founder inside Atai, performing a structured review of the project plan provided below.

Review ONLY the real plan content. Identify the most important gaps, weak areas, and strengths. Do not invent facts about the business; where the plan lacks information, that itself is a finding (a "gap").

Return ONLY a raw JSON object (no markdown fences, no commentary) with this exact shape:
{
  "summary": "2-4 sentence overall assessment of the plan's current state",
  "findings": [
    {
      "section": "<section-id>",
      "severity": "gap" | "weakness" | "strength",
      "title": "short label, e.g. 'Target customers are too broad'",
      "currentState": "what the plan currently says (quote or describe); for gaps use '(not defined yet)'",
      "why": "why this matters, in business terms",
      "recommendation": "the specific action to take"
    }
  ],
  "proposals": [
    {
      "section": "<section-id>",
      "proposedValue": "complete replacement text for the section",
      "reason": "why this improves the plan"
    }
  ],
  "nextBestAction": { "section": "<section-id>", "title": "the single most valuable next step", "why": "why this first" }
}

Rules:
- Valid section ids: ${PLAN_SECTIONS.map((d) => d.id).join(", ")}
- Include 3-8 findings covering the most consequential issues and at most 2 genuine strengths.
- Include at most 3 proposals — only where a concrete, well-founded improvement is possible from the existing context.
- Severity meanings: "gap" = section missing entirely, "weakness" = present but vague/broad/risky, "strength" = solid, keep it up.
- When reviewing "Runtime & Integrations", measure the section against the ATAI RUNTIME CAPABILITIES context: a generic infrastructure list (storage, websockets, third-party APIs) that does not name @atai-group/sdk, ATAI_API_KEY, /api/runtime/v1, and catalog capabilities is a weakness — propose a rewrite. Flag invented capabilities as weaknesses, and treat needed-but-missing capabilities as gaps.
- "Marketing Plan" is ONE combined section: a proposal for it must cover marketing, launch AND growth together (acquisition channels, a phased launch sequence, and post-launch growth loops with milestones) — never only one of the three and never a single shallow paragraph.
- "Design Direction" is ONE combined section: a proposal for it must cover brand identity, the visual system (palette with hex codes, UI style, density, radius, shadows), typography with real font names and weights, the light/dark theme strategy, AND responsive behaviour per device — never only one of those pieces and never generic "modern and clean" advice.
- "Vision, Purpose, Problem & Solution" is ONE combined section: a proposal for it must cover the vision, the mission, a concrete problem statement and the solution with differentiators together — never only one of those parts and never generic business-speak.`

// ─── Response parsing ─────────────────────────────────────────────────────────

const SECTION_ID_SET = new Set(PLAN_SECTIONS.flatMap((d) => [d.id as string]))

/** Extract the optional <plan-update> block from a chat reply. */
/**
 * Read one string field out of a JSON object the provider never finished
 * writing. Walks the literal honouring escapes and stops at the closing quote
 * or wherever the response ran out — so a draft cut at the token limit is still
 * usable instead of being thrown away.
 */
function readJsonStringField(fragment: string, key: string): string {
  const keyIdx = fragment.search(new RegExp(`"${key}"\\s*:\\s*"`))
  if (keyIdx < 0) return ""
  const raw = fragment.slice(fragment.indexOf('"', fragment.indexOf(':', keyIdx)) + 1)
  let value = ""
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === "\\") {
      const next = raw[++i]
      if (next === undefined) break
      if (next === "u") {
        const hex = raw.slice(i + 1, i + 5)
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) break
        value += String.fromCharCode(parseInt(hex, 16))
        i += 4
        continue
      }
      value += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next
      continue
    }
    if (ch === '"') break
    value += ch
  }
  return value.trim()
}

type ParsedPlanUpdate = { section: string; proposedValue: string; reason: string } | null

/**
 * Recover a `<plan-update>` block the provider never finished writing.
 *
 * Long section drafts exceed the output limit mid-string, so the JSON is valid
 * up to the cut. Without this the whole proposal is thrown away and the founder
 * loses the Add-to-plan card for an answer they can see — so read the fields we
 * have and close the string where it stopped.
 */
function parsePartialPlanUpdate(fragment: string): ParsedPlanUpdate {
  const section = fragment.match(/"section"\s*:\s*"([^"]*)"/)?.[1] ?? ""
  const proposedValue = readJsonStringField(fragment, "proposedValue")
  if (!section || !proposedValue) return null
  const reason = fragment.match(/"reason"\s*:\s*"([^"]*)"/)?.[1]?.trim() || "Drafted by the co-founder."
  return { section, proposedValue, reason }
}

export function parseChatProposal(
  reply: string,
): { cleanReply: string; proposal: ParsedPlanUpdate } {
  const blockStart = reply.indexOf("<plan-update>")
  if (blockStart === -1) return { cleanReply: reply.trim(), proposal: null }

  const afterTag = blockStart + "<plan-update>".length
  const closeTag = reply.indexOf("</plan-update>", afterTag)
  const fragment = closeTag === -1 ? reply.slice(afterTag) : reply.slice(afterTag, closeTag)
  // Everything from the opening tag onward is protocol, complete or not.
  const prose = closeTag === -1 ? "" : reply.slice(closeTag + "</plan-update>".length)
  const cleanReply = (reply.slice(0, blockStart) + prose.replace(/<plan-update>[\s\S]*$/, "")).trim()

  let proposal: ParsedPlanUpdate = null
  try {
    const raw = JSON.parse(fragment.trim()) as Record<string, unknown>
    const section = typeof raw.section === "string" ? raw.section : ""
    const proposedValue = typeof raw.proposedValue === "string" ? raw.proposedValue : ""
    const reason = typeof raw.reason === "string" ? raw.reason : ""
    if (SECTION_ID_SET.has(section) && proposedValue.trim()) {
      proposal = { section, proposedValue: proposedValue.trim(), reason: reason.trim() || "Improves the plan." }
    }
  } catch {
    proposal = parsePartialPlanUpdate(fragment)
  }

  if (proposal && !SECTION_ID_SET.has(proposal.section)) proposal = null
  return { cleanReply, proposal }
}

/** Raw shape the analyze prompt asks the model to emit. */
interface RawAnalysis {
  summary?: unknown
  findings?: unknown
  proposals?: unknown
  nextBestAction?: unknown
}

function toProposal(p: { section?: unknown; proposedValue?: unknown; reason?: unknown }, source: "chat" | "analysis"): PlanProposal | null {
  const section = typeof p.section === "string" ? p.section : ""
  const proposedValue = typeof p.proposedValue === "string" ? p.proposedValue.trim() : ""
  if (!SECTION_ID_SET.has(section) || !proposedValue) return null
  return {
    id: cryptoId(),
    section,
    currentValue: "", // filled by the route from the real spec
    proposedValue: clampPlanSectionValue(proposedValue),
    reason: typeof p.reason === "string" && p.reason.trim() ? p.reason.trim() : "Improves the plan.",
    source,
    createdAt: new Date().toISOString(),
  }
}

/** Parse and hard-validate the analysis JSON emitted by the model.
 * Findings referencing unknown sections are dropped; proposals for unknown
 * sections are dropped. Never throws. */
export function parseAnalysisResponse(text: string, spec: ApplicationSpecification, source: "chat" | "analysis" = "analysis"): PlanAnalysis | null {
  // Extract raw JSON (tolerate fences or stray prose).
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  const candidate = fenceMatch ? fenceMatch[1] : text
  const braceStart = candidate.indexOf("{")
  const braceEnd = candidate.lastIndexOf("}")
  if (braceStart === -1 || braceEnd <= braceStart) return null

  let raw: RawAnalysis
  try {
    raw = JSON.parse(candidate.slice(braceStart, braceEnd + 1)) as RawAnalysis
  } catch {
    return null
  }

  const sectionDef = (id: string): PlanSectionDef | undefined => PLAN_SECTIONS.find((d) => d.id === id)

  const findings = Array.isArray(raw.findings)
    ? raw.findings
      .map((f) => {
        const ff = f as Record<string, unknown>
        const section = typeof ff.section === "string" ? ff.section : ""
        if (!SECTION_ID_SET.has(section)) return null
        const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
        const severity = ff.severity === "gap" || ff.severity === "weakness" || ff.severity === "strength" ? ff.severity : null
        if (!severity) return null
        const title = str(ff.title)
        if (!title) return null
        const def = sectionDef(section)
        return {
          section,
          severity,
          title,
          currentState: str(ff.currentState) || (def ? def.read(spec) || "(not defined yet)" : ""),
          why: str(ff.why),
          recommendation: str(ff.recommendation),
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .slice(0, 10)
    : []

  const proposals = Array.isArray(raw.proposals)
    ? (raw.proposals.map((p) => toProposal(p as Record<string, unknown>, source)).filter((p): p is PlanProposal => p !== null) as PlanProposal[]).slice(0, 5)
    : []

  const nba = (raw.nextBestAction ?? {}) as Record<string, unknown>
  const nbaSection = typeof nba.section === "string" ? nba.section : ""
  const nextBestAction =
    SECTION_ID_SET.has(nbaSection) && typeof nba.title === "string" && nba.title.trim()
      ? { section: nbaSection, title: nba.title.trim(), why: typeof nba.why === "string" ? nba.why.trim() : "" }
      : undefined

  const health = computePlanHealth(spec)

  const parsed = PlanAnalysisSchema.safeParse({
    generatedAt: Date.now(),
    healthPercent: health.percent,
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    findings,
    proposals,
    ...(nextBestAction ? { nextBestAction } : {}),
  })
  if (!parsed.success) return null
  return parsed.data
}

// ─── Proposal helpers ─────────────────────────────────────────────────────────

/** Build a persisted proposal record from a parsed chat proposal, stamping
 * the REAL current value from the spec (never the AI's claim of it). */
export function buildProposal(spec: ApplicationSpecification, parsed: { section: string; proposedValue: string; reason: string }, source: "chat" | "analysis"): PlanProposal {
  const def = PLAN_SECTIONS.find((d) => d.id === parsed.section)
  return {
    id: cryptoId(),
    section: parsed.section,
    currentValue: def ? def.read(spec) : "",
    proposedValue: clampPlanSectionValue(parsed.proposedValue),
    reason: parsed.reason,
    source,
    createdAt: new Date().toISOString(),
  }
}

/** Extract an "Accepted decision" note — deterministic, from the proposal. */
export function decisionForProposal(p: PlanProposal): string {
  const def = PLAN_SECTIONS.find((d) => d.id === p.section)
  return `Updated ${def?.label ?? p.section}: ${p.proposedValue.slice(0, 200)}`
}

// ─── Auto-complete (co-founder drafts missing sections) ───────────────────

export const COFOUNDER_AUTOCOMPLETE_SYSTEM = `You are the founder's AI co-founder working through their business plan, drafting the sections that are still missing.

You will receive the project's compact plan brief (every section, one line each) and one FOCUS SECTION to write. Ground everything in the brief: same product, same customers, same model. If a related section is still undefined, make reasonable, conservative choices and keep them consistent with everything that IS defined — never contradict the brief.

Write the complete replacement text for the focus section:
- Business language, concrete and specific to THIS business — no generic filler, no technical jargon.
- 2-5 short paragraphs or tight bullet points, unless a section-specific instruction below requires a fuller multi-part plan. This is a founder's plan, not an essay.
- For the "Runtime & Integrations" section: write THIS product's Atai runtime contract, not a generic architecture list. Always include (1) @atai-group/sdk, (2) ATAI_API_KEY that Atai provisions for unified access, (3) origin https://atai.ink and path /api/runtime/v1, (4) only catalog capabilities this product genuinely needs, each named as capability id and SDK call (e.g. ai.text / atai.ai.chat) plus one sentence on what it does here. Never list generic infrastructure (data storage, file storage, websockets, background jobs, admin dashboards, logging, unnamed third-party APIs). Never mention OpenAI, Stripe, Resend, or other provider keys. End-user sign-in stays the app's built-in auth. If no catalog capability applies, say so and still name the SDK and ATAI_API_KEY.
- For the "SEO & Search" section: derive everything from the brief — target keywords from what the product actually does and who it serves, the pages those keywords map to, on-page metadata (titles and descriptions), whether a blog or content pages genuinely help THIS business, local or niche directories if relevant, and verifying the deployed domain in Google Search Console. Concrete and specific — never generic SEO advice.
- For the "Marketing Plan" section: ONE combined, detailed go-to-market plan covering marketing, launch AND growth. Use markdown headings and include (1) positioning and message, (2) at least three acquisition channels with concrete tactics and the signal each works, (3) a phased launch sequence — pre-launch, launch week, first 30 days, (4) post-launch growth loops (retention, referrals, expansion, content compounding) with 90-day milestones, and (5) the 3-5 metrics and honest budget/time commitment that judge the plan. Never write a single shallow paragraph and never split it into separate marketing, launch and growth plans. Keep the whole plan under about 7,000 characters so the end is never trimmed.
- For the "Design Direction" section: ONE combined design direction covering brand identity and personality, a colour palette with hex codes (primary, accent, neutrals and semantic colours), the visual system (UI style, density, radius, shadows), typography (real heading/body/mono font names with weights and type scale), theme (default light/dark/system and whether users can toggle), and responsive behaviour per device including the worst-case screen. Use markdown headings; never cover only one of those pieces and never give generic "modern and clean" advice. Keep it under about 7,000 characters so the end is never trimmed.
- For the "Vision, Purpose, Problem & Solution" section: ONE combined foundation in a single coherent story. Use markdown headings and include (1) the long-term vision, (2) the mission and why the business exists, (3) a concrete problem statement — who feels it, what breaks down, what it costs, and how people cope today — and (4) how this product solves it, why it is different, and the tangible outcomes users get. Never write only one of those parts and never generic business-speak. Keep it under about 7,000 characters so the end is never trimmed.
- If the plan lacks information you would need, choose sensible defaults consistent with the brief rather than asking questions — the founder can edit anything afterwards.
- Same language as the plan brief.

Return ONLY a raw JSON object (no markdown fences, no commentary):
{"value": "the complete new text for the focus section"}`

/** Parse a draft response: an object with `value` (string), optionally fenced.
 * Returns null for anything unusable. Never throws. */
export function parseDraftResponse(text: string): { value: string } | null {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  const candidate = fenceMatch ? fenceMatch[1] : text
  const braceStart = candidate.indexOf("{")
  const braceEnd = candidate.lastIndexOf("}")
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      const raw = JSON.parse(candidate.slice(braceStart, braceEnd + 1)) as { value?: unknown }
      const value = typeof raw.value === "string" ? raw.value.trim() : ""
      return value ? { value } : null
    } catch {
      const value = readJsonStringField(candidate, "value")
      return value ? { value } : null
    }
  }
  // An opening brace with no closing one means the draft hit the output limit —
  // take the text the model wrote instead of refunding and failing the section.
  if (braceStart !== -1) {
    const value = readJsonStringField(candidate, "value")
    if (value) return { value }
    return null
  }
  // Tolerate a bare-text reply — if the model skipped the JSON entirely,
  // non-empty prose is still a usable draft.
  const bare = text.trim()
  if (bare && !bare.startsWith("<")) return { value: bare }
  return null
}
