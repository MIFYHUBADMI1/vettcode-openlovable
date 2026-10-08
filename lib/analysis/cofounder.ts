import type { ApplicationSpecification } from "@/lib/types/specification"
import { PLAN_SECTIONS, sectionStatus, computePlanHealth, isPlaceholderValue, type PlanSectionDef } from "@/lib/analysis/plan-sections"
import { PlanAnalysisSchema, type PlanAnalysis, type PlanProposal } from "@/lib/types/plan-analysis"
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
    related.length ? `Sections commonly affected by this one: ${related.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
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
  conversation: ConversationMessage[]
  /** Section the founder is currently focused on, if any. */
  activeSection?: string | null
  /** How many recent conversation messages to include. */
  historyLimit?: number
  founderVision?: string
  sourceUrl?: string
}

export function buildCollaborateContext(input: CollaborateContextInput): string {
  const { spec, preferences, decisions, conversation, activeSection, historyLimit = 12, founderVision, sourceUrl } = input
  const health = computePlanHealth(spec)
  const missing = health.sections.filter((x) => x.status !== "complete").map((x) => x.label)

  const blocks: string[] = []

  blocks.push(
    [
      "PROJECT CONTEXT (real data — never invent facts about this project):",
      `Name: ${spec.title}`,
      `Type: ${spec.applicationType}`,
      `Description: ${spec.description}`,
      `Purpose: ${spec.purpose}`,
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
  }

  return blocks.join("\n\n")
}

// ─── Co-founder system prompts ────────────────────────────────────────────────

/** Detailed templates for each section type — these guide the AI to produce
 * production-ready, comprehensive content while keeping token costs reasonable
 * through template reuse. */
const SECTION_DETAIL_TEMPLATES = {
  problem: `When working on Problem, provide a COMPLETE problem analysis:

## Core Problem Statement
2-3 clear sentences defining the fundamental problem.

## Impact & Pain Points
3-5 specific bullets on how this problem hurts the target user:
- What breaks down?
- What gets delayed?
- What costs more than it should?
- What frustration or risk exists?

## Current Alternatives
2-3 bullets on how people solve this today and why those solutions fail or fall short.

## The Opportunity
1 paragraph: Why now? What changed that makes this solvable? What market or tech shift creates the opening?

## Success Metrics  
2-3 bullets: How will we know the problem is solved? What changes for users?

Format with markdown. Be specific — no generic business-speak.`,

  solution: `When working on Solution, provide a COMPLETE solution breakdown:

## Core Solution
2-3 sentences: What does this product do to solve the problem?

## Key Differentiators
3-5 bullets: What makes this solution unique, better, or faster than alternatives?

## User Benefits
3-5 specific bullets: What tangible outcomes do users get?
- Time saved?
- Money saved?
- New capability unlocked?
- Risk eliminated?

## How It Works (High-Level)
2-3 sentences on the technical or operational approach. Stay high-level unless asked for depth.

## Why This Will Work
2-3 sentences: Prior art, validation, or proof points that this approach is sound.

Be specific about what the product DOES, not just what it IS.`,

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

  brandIdentity: `When working on Brand & Visual Identity, provide:

## Brand Colors

**Primary Brand Color**: Hex code + description (e.g., #3B82F6 — bright blue, energetic and trustworthy)

**Secondary/Accent Color**: Hex code + use case

**Neutral Palette**: Background, surface, border colors (light mode and dark mode if applicable)

**Semantic Colors**: Success (green), warning (yellow), error (red), info (blue) — specify hex codes

## Logo & Mark

**Logo Style**: Wordmark? Icon + text? Symbol only?

**Logo Personality**: Minimal? Bold? Playful? Professional? Technical?

**Favicon Approach**: Letter? Icon? Abstract mark?

## Visual Personality

Choose 3-5 words that describe the brand's visual feel:
- Modern, minimal, clean?
- Bold, vibrant, energetic?
- Serious, professional, trustworthy?
- Friendly, approachable, warm?

## Imagery & Graphics Style

- Illustrations? Photos? Abstract shapes? Icons?
- Rounded corners? Sharp edges?
- Shadows and depth? Flat design?

Be specific — these choices directly affect the generated UI.`,

  themePreferences: `When working on Theme & Appearance, provide:

## Color Theme

**Default Theme**: Light / Dark / System (auto-switch based on OS)

**Theme Options for Users**: 
- Should users be able to toggle light/dark mode? 
- Fixed theme or user choice?

## Typography

**Heading Font**: Font family name (e.g., "Inter", "Poppins", "System UI")
- Weight for H1, H2, H3?
- Tracking (tight, normal, wide)?

**Body Font**: Font family name
- Weight: 400 (normal) or 500 (medium)?
- Line height: relaxed (1.6) or tight (1.4)?

**Monospace Font** (for code, numbers, technical data):
Font family (e.g., "Fira Code", "JetBrains Mono", "Courier")

## UI Style

**Design System Approach**:
- Minimal (Apple/Linear style — lots of whitespace, subtle borders)?
- Glassmorphism (frosted glass, backdrop blur, translucent surfaces)?
- Modern SaaS (shadcn/ui, Tailwind style — clean, functional, accessible)?
- Bold/Vibrant (high contrast, saturated colors, strong shadows)?

**Component Density**:
- Compact (tight spacing, small padding)?
- Comfortable (balanced)?
- Spacious (generous whitespace)?

**Radius/Roundness**:
- Sharp (no border radius)?
- Subtle (small radius, 4-6px)?
- Rounded (medium radius, 8-12px)?
- Pill-shaped (large radius, 16px+)?

**Shadows & Depth**:
- Flat (no shadows)?
- Subtle (soft shadows)?
- Elevated (pronounced depth)?

Be specific — the builder will apply these choices to every component.`,

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
- Phone/SMS?
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
- When reviewing "Runtime & Integrations", measure the section against the ATAI RUNTIME CAPABILITIES context: a generic infrastructure list (storage, websockets, third-party APIs) that does not name @atai-group/sdk, ATAI_API_KEY, /api/runtime/v1, and catalog capabilities is a weakness — propose a rewrite. Flag invented capabilities as weaknesses, and treat needed-but-missing capabilities as gaps.`

// ─── Response parsing ─────────────────────────────────────────────────────────

const SECTION_ID_SET = new Set(PLAN_SECTIONS.flatMap((d) => [d.id as string]))

/** Extract the optional <plan-update> block from a chat reply. */
export function parseChatProposal(
  reply: string,
): { cleanReply: string; proposal: { section: string; proposedValue: string; reason: string } | null } {
  const match = reply.match(/<plan-update>([\s\S]*?)<\/plan-update>/)
  if (!match) return { cleanReply: reply.trim(), proposal: null }

  let proposal: { section: string; proposedValue: string; reason: string } | null = null
  try {
    const raw = JSON.parse(match[1].trim()) as Record<string, unknown>
    const section = typeof raw.section === "string" ? raw.section : ""
    const proposedValue = typeof raw.proposedValue === "string" ? raw.proposedValue : ""
    const reason = typeof raw.reason === "string" ? raw.reason : ""
    if (SECTION_ID_SET.has(section) && proposedValue.trim()) {
      proposal = { section, proposedValue: proposedValue.trim(), reason: reason.trim() || "Improves the plan." }
    }
  } catch {
    proposal = null // malformed AI output is discarded, reply still shown
  }

  const cleanReply = reply.replace(/<plan-update>[\s\S]*?<\/plan-update>/g, "").trim()
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
    proposedValue,
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
    proposedValue: parsed.proposedValue,
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
- 2-5 short paragraphs or tight bullet points. This is a founder's plan, not an essay.
- For the "Runtime & Integrations" section: write THIS product's Atai runtime contract, not a generic architecture list. Always include (1) @atai-group/sdk, (2) ATAI_API_KEY that Atai provisions for unified access, (3) origin https://atai.ink and path /api/runtime/v1, (4) only catalog capabilities this product genuinely needs, each named as capability id and SDK call (e.g. ai.text / atai.ai.chat) plus one sentence on what it does here. Never list generic infrastructure (data storage, file storage, websockets, background jobs, admin dashboards, logging, unnamed third-party APIs). Never mention OpenAI, Stripe, Twilio, Resend, or other provider keys. End-user sign-in stays the app's built-in auth. If no catalog capability applies, say so and still name the SDK and ATAI_API_KEY.
- For the "SEO & Search" section: derive everything from the brief — target keywords from what the product actually does and who it serves, the pages those keywords map to, on-page metadata (titles and descriptions), whether a blog or content pages genuinely help THIS business, local or niche directories if relevant, and verifying the deployed domain in Google Search Console. Concrete and specific — never generic SEO advice.
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
  if (braceStart === -1 || braceEnd <= braceStart) {
    // Tolerate a bare-text reply — if the model skipped the JSON entirely,
    // non-empty prose is still a usable draft.
    const bare = text.trim()
    if (bare && !bare.startsWith("<")) return { value: bare }
    return null
  }
  try {
    const raw = JSON.parse(candidate.slice(braceStart, braceEnd + 1)) as { value?: unknown }
    const value = typeof raw.value === "string" ? raw.value.trim() : ""
    return value ? { value } : null
  } catch {
    return null
  }
}
