/**
 * AI artifacts
 * ------------
 * Every structured result (and every unparsed model answer) the planning
 * pipeline produces is persisted on the project so the Collaborate workspace
 * can show exactly what the AI returned. Artifacts are additive: they never
 * gate the pipeline, and a parse failure keeps the raw text instead of
 * discarding it.
 */

export type AIArtifactKind =
  | "understanding"
  | "research"
  | "specification"
  | "critique"
  | "repair"
  | "validation"
  | "sanitization"
  | "final_spec"
  | "raw_failure"

/** ready = parsed and used; fallback = pipeline continued with a substitute;
 * unparsed = the model answered but the answer could not be parsed;
 * failed = the stage produced nothing usable and no raw text exists. */
export type AIArtifactStatus = "ready" | "fallback" | "unparsed" | "failed"

export interface AIArtifact {
  id: string
  kind: AIArtifactKind
  /** Human label shown on the card, e.g. "Application specification". */
  label: string
  status: AIArtifactStatus
  /** Pipeline stage that produced it (also the dedupe scope for failures). */
  stage?: string
  /** Parsed content — what the rest of the product consumes. */
  content?: unknown
  /** Exact model text. Kept on failures so nothing is hidden; also kept on
   * successful generations so the stored plan can be verified against it. */
  rawText?: string
  /** One honest sentence about the status. */
  note?: string
  /** Model that produced the output, when known. */
  model?: string
  at: number
}

/** Per-artifact cap for stored raw model text (Mongo document safety). */
export const MAX_AI_ARTIFACT_RAW_LENGTH = 20_000

/** Upper bound on artifacts kept on a project. */
export const MAX_AI_ARTIFACTS = 24

export function clipArtifactText(text: string): string {
  if (text.length <= MAX_AI_ARTIFACT_RAW_LENGTH) return text
  return `${text.slice(0, MAX_AI_ARTIFACT_RAW_LENGTH)}\n\n[…truncated at ${MAX_AI_ARTIFACT_RAW_LENGTH.toLocaleString()} characters]`
}

export interface NewAIArtifact {
  kind: AIArtifactKind
  label: string
  status: AIArtifactStatus
  stage?: string
  content?: unknown
  rawText?: string
  note?: string
  model?: string
  at?: number
}

export function makeAIArtifact(input: NewAIArtifact): AIArtifact {
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    label: input.label,
    status: input.status,
    stage: input.stage,
    content: input.content,
    rawText: input.rawText ? clipArtifactText(input.rawText) : undefined,
    note: input.note,
    model: input.model,
    at: input.at ?? Date.now(),
  }
}

/** Raw model text carried by pipeline errors (parse failures set it). */
export function rawTextFromError(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("rawText" in error)) return undefined
  const value = (error as { rawText?: unknown }).rawText
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

/** Pipeline stage carried by PipelineError, when present. */
export function stageFromError(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("stage" in error)) return undefined
  const value = (error as { stage?: unknown }).stage
  return typeof value === "string" ? value : undefined
}
