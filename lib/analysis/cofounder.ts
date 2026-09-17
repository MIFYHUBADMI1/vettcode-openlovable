import type { ApplicationSpecification } from "@/lib/types/specification"
import { PLAN_SECTIONS, sectionStatus, computePlanHealth, type PlanSectionDef } from "@/lib/analysis/plan-sections"
import { PlanAnalysisSchema, type PlanAnalysis, type PlanProposal } from "@/lib/types/plan-analysis"
import type { ConversationMessage, ProjectPreferences } from "@/lib/types/project"
// Import the standalone ID helper directly — NOT from store.ts, which would
// pull the mongo store (server-only) into client-bundlable/testable modules.
import { cryptoId } from "@/lib/store/id"

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
}

export function buildCollaborateContext(input: CollaborateContextInput): string {
  const { spec, preferences, decisions, conversation, activeSection, historyLimit = 12 } = input
  const health = computePlanHealth(spec)
  const missing = health.sections.filter((x) => x.status === "missing").map((x) => x.label)

  const blocks: string[] = []

  blocks.push(
    [
      "PROJECT CONTEXT (real data — never invent facts about this project):",
      `Name: ${spec.title}`,
      `Type: ${spec.applicationType}`,
      `Description: ${spec.description}`,
      `Purpose: ${spec.purpose}`,
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

  if (decisions.length) {
    blocks.push(`ACCEPTED DECISIONS (the founder has approved these — respect them):\n${decisions.slice(-15).map((d) => `- ${d}`).join("\n")}`)
  }

  if (activeSection) {
    const def = PLAN_SECTIONS.find((d) => d.id === activeSection)
    if (def) blocks.push(`FOCUS SECTION: the founder is currently working on "${def.label}".`)
  }

  const recent = conversation.slice(-historyLimit)
  if (recent.length) {
    const transcript = recent
      .map((m) => `${m.role === "user" ? "Founder" : m.role === "assistant" ? "You" : "System"}: ${m.content}`)
      .join("\n")
    blocks.push(`RECENT COLLABORATION (most recent last):\n${transcript}`)
  }

  return blocks.join("\n\n")
}

// ─── Co-founder system prompts ────────────────────────────────────────────────

export const COFOUNDER_CHAT_SYSTEM = `You are the founder's AI co-founder inside Atai, working alongside the owner of this project. You have the project's current plan and relevant context below.

Your responsibility is to help the founder turn their idea into a stronger, clearer, more actionable business and product plan.

How you behave:
- Ground every statement in the PROJECT CONTEXT. If the plan does not contain the information being asked about, say so plainly (for example: "I don't have your pricing defined yet — let's work that out") and help create it. NEVER fabricate project facts, customers, numbers, or decisions.
- Think like a co-founder, not a cheerleader. When something is weak, say so constructively and explain WHY it matters. Challenge broad assumptions respectfully.
- Think across the whole plan: when something the founder says affects other sections (for example, a new target customer changes positioning and marketing), point that out.
- Respond in plain, business-friendly language. No technical jargon unless asked. Keep replies focused — a few short paragraphs at most. Use short markdown headings or bold labels for structure when it helps.
- The founder is the decision-maker. Advise, recommend, and propose — never pretend to have already changed anything.

Proposing plan updates:
- When a concrete improvement to a plan section would clearly help, propose it.
- End your reply with ONE proposal block in exactly this format (only when a real proposal exists; omit it entirely otherwise):

<plan-update>
{"section": "<section-id>", "proposedValue": "<the full new text for that section>", "reason": "<why this improves the plan>"}
</plan-update>

Valid section ids: ${PLAN_SECTIONS.map((d) => d.id).join(", ")}
"proposedValue" must be the complete replacement text for the section, in the same language as the conversation.`

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
- Severity meanings: "gap" = section missing entirely, "weakness" = present but vague/broad/risky, "strength" = solid, keep it up.`

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
