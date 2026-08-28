// app/api/generation-pipeline/route.ts
// SSE orchestration endpoint — runs all 5 phases in order, streams PipelineEvent
// objects to the client, and drains the EditQueue after completion (Req 6.1–6.3, 7.6).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { PhaseStateMachine } from '../../../lib/pipeline/phase-state-machine';
import { AnalysisPhaseHandler } from '../../../lib/pipeline/phases/analysis';
import { InstantPreviewPhaseHandler } from '../../../lib/pipeline/phases/instant-preview';
import { ProgressiveCloningPhaseHandler } from '../../../lib/pipeline/phases/progressive-cloning';
import { ValidationPhaseHandler } from '../../../lib/pipeline/phases/validation';
import { PolishPhaseHandler } from '../../../lib/pipeline/phases/polish';
import { globalEditQueue } from '../../../lib/pipeline/edit-queue-instance';
import { sessionMutex } from '../../../lib/session-mutex';
import { PipelineStore } from '../../../lib/pipeline/pipeline-store';
import { SandboxFactory } from '../../../lib/sandbox/factory';
import type { SandboxProvider } from '../../../lib/sandbox/types';
import {
  setInitialGenerationActive,
  isInitialGenerationActiveFlag,
} from '../generate-ai-code-stream/route';
import { resolveApiUrl } from '../../../lib/pipeline/phase-endpoint';
import type {
  PhaseState,
  ProgressEvent,
  QueuedEdit,
  SiteBlueprint,
} from '../../../lib/pipeline/types';
import type { PersistedPipelineContext } from '../../../lib/pipeline/pipeline-store';

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

interface GenerationPipelineRequest {
  url?: string;
  sessionId: string;
  sandboxId?: string;
  resume?: boolean;
}

/** Ordering of phases for resume skip logic (Req 6.4). */
const PHASE_RANKS: Record<PhaseState, number> = {
  idle: -1,
  analyzing: 0,
  instant_preview: 1,
  progressive_cloning: 2,
  validating: 3,
  polishing: 4,
  complete: 5,
  error: -1,
};

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEncode(
  encoder: TextEncoder,
  data: Record<string, unknown>,
): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  /**
   * Write a PipelineEvent to the SSE stream.
   * All pipeline events share this shape at the top level; the specific
   * fields vary by type.
   */
  const emit = async (event: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(sseEncode(encoder, event));
    } catch {
      // Writer may already be closed if the client disconnected.
    }
  };

  // ---------------------------------------------------------------------------
  // Parse request
  // ---------------------------------------------------------------------------

  let body: GenerationPipelineRequest;
  try {
    body = (await request.json()) as GenerationPipelineRequest;
  } catch {
    await writer.write(
      sseEncode(encoder, {
        type: 'error',
        message: 'Invalid request body — expected JSON',
        phase: 'idle',
        timestamp: Date.now(),
      }),
    );
    await writer.close();
    return new Response(stream.readable, {
      headers: sseHeaders(),
    });
  }

  const { url, sessionId, sandboxId, resume = false } = body;

  if (!sessionId) {
    await writer.write(
      sseEncode(encoder, {
        type: 'error',
        message: 'Missing required field: sessionId',
        phase: 'idle',
        timestamp: Date.now(),
      }),
    );
    await writer.close();
    return new Response(stream.readable, { headers: sseHeaders() });
  }

  // ---------------------------------------------------------------------------
  // Run pipeline in background — return the stream immediately
  // ---------------------------------------------------------------------------

  // AbortController tied to the client's SSE connection. When the client
  // disconnects (closes tab, navigates away, network drop), the request
  // signal fires and the pipeline can stop early instead of running to
  // completion against a dead stream.
  const pipelineAbort = new AbortController();
  request.signal.addEventListener('abort', () => {
    console.log('[GenerationPipeline] Client disconnected — aborting pipeline.');
    pipelineAbort.abort();
  });

  void runPipeline(
    { url, sessionId, sandboxId, resume },
    emit,
    writer,
    pipelineAbort.signal,
  );

  return new Response(stream.readable, { headers: sseHeaders() });
}

// ---------------------------------------------------------------------------
// Pipeline orchestration
// ---------------------------------------------------------------------------

async function runPipeline(
  opts: GenerationPipelineRequest,
  emit: (event: Record<string, unknown>) => Promise<void>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  abortSignal?: AbortSignal,
): Promise<void> {
  const { url, sessionId, sandboxId: requestedSandboxId, resume } = opts;

  const stateMachine = new PhaseStateMachine();
  const editQueue = globalEditQueue;

  // Flag initial generation as active so chat edits are queued instead of
  // being applied immediately (Req 11.1). Cleared on completion / error.
  const hadActiveGeneration = isInitialGenerationActiveFlag();
  setInitialGenerationActive(true);

  // Attach transition listener — emit phase_transition events (Req 6.2)
  stateMachine.on(
    'transition',
    async (evt: {
      from: PhaseState;
      to: PhaseState;
      timestamp: number;
      metadata: Record<string, unknown>;
    }) => {
      await emit({
        type: 'phase_transition',
        from: evt.from,
        to: evt.to,
        timestamp: evt.timestamp,
        phase: evt.to,
        payload: evt.metadata,
      });

      // Persist context on every transition (Req 6.4 — session persistence)
      if (resolvedSandboxId) {
        try {
          const ctx = stateMachine.getContext();
          await PipelineStore.save(sessionId, resolvedSandboxId, {
            blueprint: ctx.blueprint,
            executionLog: ctx.executionLog,
            sectionResults: ctx.sectionResults,
            lastSuccessfulPhase: ctx.lastSuccessfulPhase,
            sandboxId: resolvedSandboxId,
            sandboxUrl: previewSandboxUrl,
          });
        } catch (persistErr) {
          console.warn(
            '[GenerationPipeline] Failed to persist context:',
            persistErr,
          );
        }
      }
    },
  );

  // Mutable bindings the transition listener closes over before async work
  // resolves.
  let resolvedSandboxId: string | null = requestedSandboxId ?? null;
  let previewSandboxUrl: string | null = null;

  // ---------------------------------------------------------------------------
  // Resume check — if a persisted context exists, expose it (Req 6.4)
  // ---------------------------------------------------------------------------

  const persistedContext = await (async (): Promise<PersistedPipelineContext | null> => {
    try {
      if (resume && requestedSandboxId) {
        return await PipelineStore.load(sessionId, requestedSandboxId);
      }
      return await PipelineStore.loadLatestForSession(sessionId);
    } catch (loadErr) {
      console.warn(
        '[GenerationPipeline] Failed to load persisted context:',
        loadErr,
      );
      return null;
    }
  })();

  // The phase to resume FROM (the last one that completed successfully).
  // `resumeFromRank` is the rank of that phase; phases with a greater rank are
  // still pending and will run. -1 means "start from scratch".
  const resumeFromPhase = persistedContext?.lastSuccessfulPhase ?? null;
  const resumeFromRank =
    resume && resumeFromPhase ? PHASE_RANKS[resumeFromPhase] : -1;

  if (persistedContext && persistedContext.lastSuccessfulPhase) {
    await emit({
      type: 'phase_transition',
      from: 'idle',
      to: 'analyzing',
      timestamp: Date.now(),
      phase: 'analyzing',
      payload: {
        resumable: true,
        resuming: resume && resumeFromPhase != null,
        lastSuccessfulPhase: persistedContext.lastSuccessfulPhase,
        sandboxId: persistedContext.sandboxId ?? requestedSandboxId ?? null,
      },
    });
  }

  /** True when the given phase should still be executed during this run. */
  const shouldRun = (phase: PhaseState): boolean =>
    PHASE_RANKS[phase] > resumeFromRank;

  // Replay legal transitions up to `resumeFromPhase` so the state machine is
  // consistent with the persisted run before continuing (Req 6.4).
  if (resume && resumeFromPhase && resumeFromRank >= 0) {
    const replayChain: PhaseState[] = [
      'analyzing',
      'instant_preview',
      'progressive_cloning',
      'validating',
      'polishing',
      'complete',
    ];
    for (const phase of replayChain) {
      if (PHASE_RANKS[phase] > resumeFromRank) break;
      try {
        stateMachine.transition(phase, { resumed: true });
        stateMachine.recordPhaseStart(phase);
        stateMachine.recordPhaseEnd(phase, 'success');
      } catch {
        // A transition in the chain may be illegal from the current state —
        // skip it; the persisted log is preserved regardless.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase handlers
  // ---------------------------------------------------------------------------

  const analysisHandler = new AnalysisPhaseHandler();
  const instantPreviewHandler = new InstantPreviewPhaseHandler();
  const progressiveCloningHandler = new ProgressiveCloningPhaseHandler();
  const validationHandler = new ValidationPhaseHandler();
  const polishHandler = new PolishPhaseHandler();

  let totalTokenUsage = 0;

  // Helper: emit token_usage event and accumulate total
  const emitTokenUsage = async (
    phase: PhaseState,
    tokens: number,
  ): Promise<void> => {
    totalTokenUsage += tokens;
    await emit({
      type: 'token_usage',
      phase,
      tokens,
      timestamp: Date.now(),
    });
  };

  try {
    // -----------------------------------------------------------------------
    // Transition idle → analyzing
    // -----------------------------------------------------------------------

    if (shouldRun('analyzing')) {
      stateMachine.transition('analyzing', { url });
      stateMachine.recordPhaseStart('analyzing');
    }

    // -----------------------------------------------------------------------
    // Phase 1 — Analysis
    // -----------------------------------------------------------------------

    if (shouldRun('analyzing') && !url) {
      throw new Error('Missing required field: url');
    }

    let blueprint: SiteBlueprint;

    if (shouldRun('analyzing')) {
      // Scrape the URL
      await emit({
        type: 'phase_transition',
        phase: 'analyzing',
        timestamp: Date.now(),
        payload: { step: 'scraping' },
      });

      let scrapedContent: string;
      try {
        const scrapeResponse = await fetch(resolveApiUrl('/api/scrape-website'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const scrapeData = (await scrapeResponse.json()) as {
          success: boolean;
          data?: { markdown?: string; content?: string };
        };
        scrapedContent =
          scrapeData?.data?.markdown ?? scrapeData?.data?.content ?? '';
      } catch (scrapeErr) {
        throw new Error(
          `Failed to scrape URL: ${
            scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)
          }`,
        );
      }

      if (abortSignal?.aborted) throw new Error('Pipeline aborted: client disconnected');
      const analysisOutput = await analysisHandler.execute({ scrapedContent }, abortSignal);
      blueprint = analysisOutput.blueprint;
      stateMachine.recordPhaseEnd('analyzing', 'success');
      await emitTokenUsage('analyzing', analysisOutput.tokenUsage);
    } else if (resumeFromPhase && persistedContext?.blueprint) {
      // Resume: reuse the persisted blueprint instead of re-analyzing.
      blueprint = persistedContext.blueprint;
      await emit({
        type: 'phase_transition',
        phase: 'analyzing',
        timestamp: Date.now(),
        payload: { resumed: true, step: 'reused-persisted-blueprint' },
      });
    } else {
      throw new Error('Unable to resume: no persisted blueprint available');
    }

    // -----------------------------------------------------------------------
    // Phase 2 — Instant Preview
    // -----------------------------------------------------------------------

    // Create (or reuse) sandbox before the instant preview phase.
    let sandboxProvider: SandboxProvider;
    if (resolvedSandboxId && shouldRun('instant_preview')) {
      // Reuse an existing sandbox — the provider is created fresh and relies on
      // the sandbox still being reachable; a reconnect attempt is best-effort.
      sandboxProvider = SandboxFactory.create();
      try {
        const reconnect = (
          sandboxProvider as unknown as {
            reconnect?: (id: string) => Promise<boolean>;
          }
        ).reconnect;
        if (typeof reconnect === 'function') {
          await reconnect(resolvedSandboxId);
        }
      } catch {
        // Reconnect unsupported — continue with a fresh provider.
      }
    } else {
      sandboxProvider = SandboxFactory.create();
    }

    if (shouldRun('instant_preview')) {
      stateMachine.transition('instant_preview', {
        blueprint: blueprint.sections.length,
      });
      stateMachine.recordPhaseStart('instant_preview');

      if (!resolvedSandboxId) {
        // Use a per-session mutex so two concurrent requests for the same
        // session don't create duplicate sandboxes.
        const sandboxInfo = await sessionMutex.run(
          `sandbox-create:${sessionId}`,
          async () => {
            // Re-check inside the lock — a concurrent request may have
            // already created the sandbox while we were waiting.
            if (resolvedSandboxId) {
              return { sandboxId: resolvedSandboxId, url: null } as Awaited<ReturnType<typeof sandboxProvider.createSandbox>>;
            }
            return sandboxProvider.createSandbox();
          },
        );
        if (!resolvedSandboxId) {
          resolvedSandboxId = sandboxInfo.sandboxId;
        }
      }

      const previewOutput = await instantPreviewHandler.execute(
        blueprint,
        sandboxProvider,
      );
      previewSandboxUrl = previewOutput.sandboxUrl;

      stateMachine.recordPhaseEnd('instant_preview', 'success');
      await emitTokenUsage('instant_preview', previewOutput.tokenUsage);

      await emit({
        type: 'phase_transition',
        phase: 'instant_preview',
        timestamp: Date.now(),
        payload: {
          sandboxUrl: previewSandboxUrl,
          sandboxId: resolvedSandboxId,
        },
      });

      // Persist the preview URL right away so a later resume can point the
      // iframe at the existing sandbox.
      if (resolvedSandboxId) {
        try {
          await PipelineStore.save(sessionId, resolvedSandboxId, {
            blueprint,
            executionLog: stateMachine.getContext().executionLog,
            sectionResults: stateMachine.getContext().sectionResults,
            lastSuccessfulPhase: stateMachine.getContext().lastSuccessfulPhase,
            sandboxId: resolvedSandboxId,
            sandboxUrl: previewSandboxUrl,
          });
        } catch {
          // Non-fatal
        }
      }
    } else if (persistedContext) {
      previewSandboxUrl = persistedContext.sandboxUrl ?? null;
      resolvedSandboxId = persistedContext.sandboxId ?? resolvedSandboxId;
    }

    // -----------------------------------------------------------------------
    // Phase 3 — Progressive Cloning
    // -----------------------------------------------------------------------

    let sectionResults: import('../../../lib/pipeline/types/pipeline').SectionResult[] =
      persistedContext?.sectionResults ?? [];

    if (shouldRun('progressive_cloning')) {
      stateMachine.transition('progressive_cloning', {
        sectionCount: blueprint.sections.length,
      });
      stateMachine.recordPhaseStart('progressive_cloning');

      const onProgress = async (event: ProgressEvent): Promise<void> => {
        await emit({
          type: 'section_status',
          sectionName: event.sectionName,
          status: event.status,
          overallPercent: event.overallPercent,
          timestamp: event.timestamp,
          phase: 'progressive_cloning',
        });
      };

      if (abortSignal?.aborted) throw new Error('Pipeline aborted: client disconnected');
      sectionResults = await progressiveCloningHandler.execute(
        blueprint,
        sandboxProvider,
        onProgress,
        abortSignal,
      );

      stateMachine.recordPhaseEnd('progressive_cloning', 'success');
    }

    // -----------------------------------------------------------------------
    // Phase 4 — Validation
    // -----------------------------------------------------------------------

    const hasCloningFailures = sectionResults.some(
      (r) => r.status === 'failed',
    );

    let validationResult: import('../../../lib/pipeline/phases/validation').ValidationResult | null =
      null;

    if (shouldRun('validating')) {
      stateMachine.transition('validating', { hasCloningFailures });
      stateMachine.recordPhaseStart('validating');

      if (abortSignal?.aborted) throw new Error('Pipeline aborted: client disconnected');
      validationResult = await validationHandler.execute(sandboxProvider, abortSignal);

      if (validationResult.permanentlyFailedFiles.length > 0) {
        await emit({
          type: 'build_error',
          phase: 'validating',
          timestamp: Date.now(),
          payload: {
            permanentlyFailedFiles: validationResult.permanentlyFailedFiles,
          },
        });
      }

      // Emit a fix_attempt summary event
      if (validationResult.retriedFiles.length > 0) {
        await emit({
          type: 'fix_attempt',
          phase: 'validating',
          timestamp: Date.now(),
          payload: { retriedFiles: validationResult.retriedFiles },
        });
      }

      stateMachine.recordPhaseEnd(
        'validating',
        validationResult.success ? 'success' : 'failure',
        validationResult.success
          ? undefined
          : `${validationResult.permanentlyFailedFiles.length} file(s) could not be fixed`,
      );
      await emitTokenUsage('validating', validationResult.tokenUsage);
    }

    // -----------------------------------------------------------------------
    // Phase 5 — Polish
    // -----------------------------------------------------------------------

    const hasCriticalErrors =
      (validationResult !== null && !validationResult.success) ||
      hasCloningFailures;

    if (shouldRun('polishing')) {
      stateMachine.transition('polishing', { hasCriticalErrors });
      stateMachine.recordPhaseStart('polishing');

      if (abortSignal?.aborted) throw new Error('Pipeline aborted: client disconnected');
      const polishResult = await polishHandler.execute(
        blueprint,
        sandboxProvider,
        hasCriticalErrors,
        abortSignal,
      );

      stateMachine.recordPhaseEnd(
        'polishing',
        polishResult.completedWithWarnings ? 'failure' : 'success',
      );
      await emitTokenUsage('polishing', polishResult.tokenUsage);

      if (polishResult.warnings.length > 0) {
        await emit({
          type: 'phase_transition',
          phase: 'polishing',
          timestamp: Date.now(),
          payload: { warnings: polishResult.warnings },
        });
      }
    }

    // -----------------------------------------------------------------------
    // Transition to complete
    // -----------------------------------------------------------------------

    stateMachine.transition('complete', {
      totalTokenUsage,
      sandboxId: resolvedSandboxId,
      sandboxUrl: previewSandboxUrl,
    });

    await emit({
      type: 'complete',
      phase: 'complete',
      timestamp: Date.now(),
      payload: {
        sandboxUrl: previewSandboxUrl,
        sandboxId: resolvedSandboxId,
        totalTokenUsage,
        sectionResults,
      },
    });

    // -----------------------------------------------------------------------
    // Deduct tokens from user balance after completion (Req 7.6)
    // -----------------------------------------------------------------------

    if (totalTokenUsage > 0) {
      try {
        await deductTokens(totalTokenUsage, sessionId);
      } catch (deductErr) {
        console.warn(
          '[GenerationPipeline] Token deduction failed:',
          deductErr,
        );
      }
    }

    // -----------------------------------------------------------------------
    // Drain EditQueue — process any edits queued during initial generation
    // -----------------------------------------------------------------------

    const queuedEdits = editQueue.drain();
    if (queuedEdits.length > 0) {
      await emit({
        type: 'phase_transition',
        phase: 'complete',
        timestamp: Date.now(),
        payload: { drainingEditQueue: true, editCount: queuedEdits.length },
      });

      for (const edit of queuedEdits) {
        await processQueuedEdit(edit, resolvedSandboxId, emit);
      }
    }

    // Clean up persisted context after successful run
    if (resolvedSandboxId) {
      try {
        await PipelineStore.clear(sessionId, resolvedSandboxId);
      } catch {
        // Non-fatal
      }
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const isAbort = abortSignal?.aborted ?? false;
    console.error(
      `[GenerationPipeline] Fatal error${isAbort ? ' (client disconnected)' : ''}:`,
      errMessage,
    );

    // Attempt to transition to error state
    const currentState = stateMachine.getState();
    if (currentState !== 'error' && currentState !== 'complete') {
      try {
        stateMachine.transition('error', { reason: errMessage });
        stateMachine.recordPhaseEnd(currentState, 'failure', errMessage);
      } catch {
        // If the transition itself throws (e.g. already in error), ignore
      }
    }

    // Persist the context on abort so the user can resume later (Req 6.4).
    if (resolvedSandboxId && isAbort) {
      try {
        const ctx = stateMachine.getContext();
        await PipelineStore.save(sessionId, resolvedSandboxId, {
          blueprint: ctx.blueprint,
          executionLog: ctx.executionLog,
          sectionResults: ctx.sectionResults,
          lastSuccessfulPhase: ctx.lastSuccessfulPhase,
          sandboxId: resolvedSandboxId,
          sandboxUrl: previewSandboxUrl,
        });
      } catch {
        // Non-fatal
      }
    }

    // Only emit error event to the client when it is still connected.
    if (!isAbort) {
      await emit({
        type: 'error',
        message: errMessage,
        phase: stateMachine.getState(),
        timestamp: Date.now(),
      });
    }
  } finally {
    // Restore the pre-existing generation flag (Req 11.1).
    if (!hadActiveGeneration) {
      setInitialGenerationActive(false);
    }
    try {
      await writer.close();
    } catch {
      // Already closed
    }
  }
}

// ---------------------------------------------------------------------------
// Token deduction — reuses the /api/tokens/deduct mechanism (Req 7.6)
// ---------------------------------------------------------------------------

/**
 * Deduct `amount` tokens from the authenticated user's balance via the existing
 * tokens endpoint. Runs best-effort: failures are logged, never fatal.
 */
async function deductTokens(amount: number, sessionId: string): Promise<void> {
  const response = await fetch(resolveApiUrl('/api/tokens/deduct'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      metadata: {
        reason: 'AI generation pipeline',
        sessionId,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token deduction failed (${response.status}): ${text.slice(0, 200)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Queued edit processing
// ---------------------------------------------------------------------------

/**
 * Process a single queued edit by delegating to the existing
 * generate-ai-code-stream endpoint so that the edit flow remains unchanged
 * (Req 11.2).
 */
async function processQueuedEdit(
  edit: QueuedEdit,
  sandboxId: string | null,
  emit: (event: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  await emit({
    type: 'phase_transition',
    phase: 'complete',
    timestamp: Date.now(),
    payload: { processingQueuedEdit: edit.id, prompt: edit.prompt },
  });

  try {
    await fetch(resolveApiUrl('/api/generate-ai-code-stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: edit.prompt,
        isEdit: true,
        context: { sandboxId },
      }),
    });
  } catch (editErr) {
    console.warn(
      '[GenerationPipeline] Failed to process queued edit:',
      editErr,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Transfer-Encoding': 'chunked',
    'Content-Encoding': 'none',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// ---------------------------------------------------------------------------
// OPTIONS — CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: sseHeaders() });
}
