// lib/pipeline/types/pipeline.ts
// Shared types for the phase state machine, events, and execution log

import type { SiteBlueprint } from "./blueprint";

// ---------------------------------------------------------------------------
// Phase State Machine
// ---------------------------------------------------------------------------

/** All valid pipeline states (Req 6.1) */
export type PhaseState =
  | "idle"
  | "analyzing"
  | "instant_preview"
  | "progressive_cloning"
  | "validating"
  | "polishing"
  | "complete"
  | "error";

/** Emitted on every state transition (Req 6.2) */
export interface PhaseTransitionEvent {
  from: PhaseState;
  to: PhaseState;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  metadata: Record<string, unknown>;
}

/** One entry in the pipeline execution log (Req 6.3) */
export interface PhaseExecutionLog {
  phase: PhaseState;
  /** Unix ms */
  startTime: number;
  /** Unix ms — null while phase is still running */
  endTime: number | null;
  outcome: "success" | "failure" | "in_progress";
  failureReason?: string;
  tokenUsage?: number;
}

// ---------------------------------------------------------------------------
// Section Processing
// ---------------------------------------------------------------------------

/** Life-cycle status of a single section during Progressive Cloning (Req 3.9) */
export type SectionStatus = "pending" | "generating" | "complete" | "failed";

/** Priority tiers used to sort sections for generation order (Req 3.1) */
export type SectionPriority = "hero" | "primary" | "secondary" | "footer";

export interface SectionResult {
  sectionName: string;
  priority: SectionPriority;
  status: SectionStatus;
  /** Number of generation retries attempted (max 2, Req 9.3) */
  retryCount: number;
  error?: string;
  tokenUsage?: number;
}

// ---------------------------------------------------------------------------
// Pipeline Context
// ---------------------------------------------------------------------------

export interface QueuedEdit {
  id: string;
  prompt: string;
  /** Unix ms */
  timestamp: number;
}

/** Runtime context carried across all phases */
export interface PipelineContext {
  sandboxId: string | null;
  blueprint: SiteBlueprint | null;
  executionLog: PhaseExecutionLog[];
  sectionResults: SectionResult[];
  editQueue: QueuedEdit[];
  lastSuccessfulPhase: PhaseState | null;
  /** True while the initial 5-phase generation is running; used to gate the edit queue (Req 11.2) */
  isInitialGeneration: boolean;
}

// ---------------------------------------------------------------------------
// Pipeline Events (SSE)
// ---------------------------------------------------------------------------

export type PipelineEventType =
  | "phase_transition"
  | "section_status"
  | "file_written"
  | "hot_reload"
  | "build_error"
  | "fix_attempt"
  | "token_usage"
  | "complete"
  | "error";

/** Base shape for all SSE events emitted by the pipeline orchestration endpoint */
export interface PipelineEvent {
  type: PipelineEventType;
  /** Unix ms */
  timestamp: number;
  phase: PhaseState;
  payload: Record<string, unknown>;
}

/** Specific event shape emitted per section during Progressive Cloning (Req 3.9) */
export interface ProgressEvent {
  type: "section_status";
  sectionName: string;
  status: SectionStatus;
  /** Overall completion 0–100 */
  overallPercent: number;
  /** Unix ms */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Specific Payload Shapes
// ---------------------------------------------------------------------------

export interface PhaseTransitionPayload {
  from: PhaseState;
  to: PhaseState;
  metadata: Record<string, unknown>;
}

export interface SectionStatusPayload {
  sectionName: string;
  status: SectionStatus;
  /** 0–100 */
  overallPercent: number;
  estimatedRemainingMs?: number;
}
