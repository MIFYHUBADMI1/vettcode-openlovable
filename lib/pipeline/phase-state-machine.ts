// lib/pipeline/phase-state-machine.ts
// Central orchestrator: owns pipeline state, emits transition events, maintains execution log

import { EventEmitter } from "events";
import type {
  PhaseState,
  PhaseTransitionEvent,
  PhaseExecutionLog,
  PipelineContext,
} from "./types";

// ---------------------------------------------------------------------------
// Legal transitions per the state diagram in design.md
// ---------------------------------------------------------------------------

const LEGAL_TRANSITIONS: ReadonlyMap<PhaseState, ReadonlySet<PhaseState>> =
  new Map([
    ["idle", new Set<PhaseState>(["analyzing"])],
    ["analyzing", new Set<PhaseState>(["instant_preview", "error"])],
    [
      "instant_preview",
      new Set<PhaseState>(["progressive_cloning"]),
    ],
    [
      "progressive_cloning",
      new Set<PhaseState>(["validating", "error"]),
    ],
    [
      "validating",
      // Self-transition (fixApplied) is legal
      new Set<PhaseState>(["polishing", "validating", "error"]),
    ],
    ["polishing", new Set<PhaseState>(["complete"])],
    // error can go back to analyzing (retry) or idle (restart)
    ["error", new Set<PhaseState>(["analyzing", "idle"])],
    // Terminal states — no outgoing transitions
    ["complete", new Set<PhaseState>()],
  ]);

// ---------------------------------------------------------------------------
// PhaseStateMachine
// ---------------------------------------------------------------------------

export class PhaseStateMachine extends EventEmitter {
  private state: PhaseState = "idle";
  private context: PipelineContext;

  constructor() {
    super();
    this.context = {
      sandboxId: null,
      blueprint: null,
      executionLog: [],
      sectionResults: [],
      editQueue: [],
      lastSuccessfulPhase: null,
      isInitialGeneration: false,
    };
  }

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  /**
   * Attempt to transition to `to`. Throws if the transition is not legal per
   * the state diagram. On success:
   *   - Updates internal state
   *   - Updates `isInitialGeneration` and `lastSuccessfulPhase` as specified
   *   - Emits a `PhaseTransitionEvent`
   */
  transition(to: PhaseState, metadata: Record<string, unknown> = {}): void {
    const from = this.state;
    const allowed = LEGAL_TRANSITIONS.get(from);

    if (!allowed || !allowed.has(to)) {
      throw new Error(
        `Illegal phase transition: "${from}" → "${to}". ` +
          `Allowed from "${from}": [${allowed ? [...allowed].join(", ") : "none"}]`,
      );
    }

    // --- Side-effects before emitting -----------------------------------------

    // Set isInitialGeneration when starting the pipeline
    if (from === "idle" && to === "analyzing") {
      this.context.isInitialGeneration = true;
    }

    // Clear isInitialGeneration when generation finishes
    if (to === "complete") {
      this.context.isInitialGeneration = false;
    }

    // Record the from-state as the last successful phase whenever we are
    // making a forward (non-error) transition away from a non-idle state.
    // "successful" means: the transition leading away from `from` was not to
    // an error state and `from` is not a meta/terminal state.
    if (
      to !== "error" &&
      from !== "idle" &&
      from !== "error" &&
      from !== "complete"
    ) {
      this.context.lastSuccessfulPhase = from;
    }

    // Apply transition
    this.state = to;

    // Build and emit event
    const event: PhaseTransitionEvent = {
      from,
      to,
      timestamp: Date.now(),
      metadata,
    };

    this.emit("transition", event);
  }

  // -------------------------------------------------------------------------
  // Execution log helpers
  // -------------------------------------------------------------------------

  /**
   * Record that `phase` has started executing. Adds an in-progress log entry.
   */
  recordPhaseStart(phase: PhaseState): void {
    const entry: PhaseExecutionLog = {
      phase,
      startTime: Date.now(),
      endTime: null,
      outcome: "in_progress",
    };
    this.context.executionLog.push(entry);
  }

  /**
   * Mark the most recent log entry for `phase` as ended. Updates endTime,
   * outcome, and optionally failureReason.
   */
  recordPhaseEnd(
    phase: PhaseState,
    outcome: "success" | "failure",
    reason?: string,
  ): void {
    // Walk backwards to find the most recent in-progress entry for this phase
    const log = this.context.executionLog;
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].phase === phase && log[i].outcome === "in_progress") {
        log[i].endTime = Date.now();
        log[i].outcome = outcome;
        if (reason !== undefined) {
          log[i].failureReason = reason;
        }
        return;
      }
    }
    // If no in-progress entry found, append a completed one (defensive)
    this.context.executionLog.push({
      phase,
      startTime: Date.now(),
      endTime: Date.now(),
      outcome,
      failureReason: reason,
    });
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  /** Returns the current pipeline state. */
  getState(): PhaseState {
    return this.state;
  }

  /** Returns a read-only view of the current pipeline context. */
  getContext(): Readonly<PipelineContext> {
    return this.context as Readonly<PipelineContext>;
  }

  /**
   * Returns true when a previous pipeline run has recorded a successful phase,
   * meaning the pipeline can be resumed rather than restarted from scratch.
   */
  canResume(): boolean {
    return this.context.lastSuccessfulPhase !== null;
  }

  /** Returns the last phase that completed successfully, or null. */
  getLastSuccessfulPhase(): PhaseState | null {
    return this.context.lastSuccessfulPhase;
  }
}
