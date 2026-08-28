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
import type { PipelineInputs } from '../../../lib/pipeline/types/pipeline';
import type { PersistedPipelineContext } from '../../../lib/pipeline/pipeline-store';
import type { ColorEntry } from '../../../lib/pipeline/types/blueprint';

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

interface GenerationPipelineRequest {
  url?: string;
  sessionId: string;
  sandboxId?: string;
  resume?: boolean;
  /** User-provided generation inputs (style/model/instructions/brand mode). */
  inputs?: PipelineInputs;
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
    { url, sessionId, sandboxId, resume, inputs: body.inputs },
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
            inputs,
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

  // Effective user inputs: prefer what the client sent; on resume fall back
  // to the inputs persisted with the previous run so style/model/instructions
  // survive a resume (Req: no generation input lost when switching entries).
  const inputs: PipelineInputs =
    opts.inputs && Object.keys(opts.inputs).length > 0
      ? opts.inputs
      : (persistedContext?.inputs ?? {});

  const pipelineStart = Date.now();
  console.log(
    `[Phase: analyzing] Pipeline run starting — url=${url ?? '(resume)'}, ` +
    `sessionId=${sessionId}, resume=${resume}, mode=${inputs.mode ?? 'clone'}, ` +
    `style=${inputs.style ?? 'none'}, model=${inputs.model ?? 'default'}, ` +
    `instructions=${inputs.instructions ? 'yes' : 'no'}, siteMarkdown=${inputs.siteMarkdown ? 'yes' : 'no'}`,
  );

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
    let brandGuidelines: Record<string, unknown> | null = null;

    if (shouldRun('analyzing')) {
      if (inputs.mode === 'brand') {
        // Brand-extension mode: extract brand guidelines and synthesize a
        // single-section blueprint instead of cloning the original site.
        const analyzeStart = Date.now();
        await emit({
          type: 'phase_transition',
          phase: 'analyzing',
          timestamp: Date.now(),
          payload: { step: 'brand-extraction' },
        });
        console.log(
          `[Phase: analyzing] Brand-extension mode — extracting brand styles for ${url}`,
        );

        const extractResponse = await fetch(
          resolveApiUrl('/api/extract-brand-styles'),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, prompt: inputs.brandPrompt ?? '' }),
          },
        );
        if (!extractResponse.ok) {
          throw new Error(
            `Brand style extraction failed (${extractResponse.status})`,
          );
        }
        const extractData = (await extractResponse.json()) as {
          success: boolean;
          error?: string;
          guidelines?: Record<string, unknown>;
        };
        if (!extractData.success || !extractData.guidelines) {
          throw new Error(
            extractData.error ?? 'Failed to extract brand styles',
          );
        }
        brandGuidelines = extractData.guidelines;
        blueprint = buildBrandBlueprint(brandGuidelines);
        stateMachine.recordPhaseEnd('analyzing', 'success');
        console.log(
          `[Phase: analyzing] Brand blueprint synthesized in ${Date.now() - analyzeStart}ms — ` +
          `${blueprint.sections.length} section, ${blueprint.colors.length} brand colors`,
        );
      } else {
        // Clone mode: scrape the URL (or use client-provided markdown from
        // search results, which skips the scrape entirely).
        const analyzeStart = Date.now();
        await emit({
          type: 'phase_transition',
          phase: 'analyzing',
          timestamp: Date.now(),
          payload: { step: 'scraping' },
        });

        let scrapedContent: string;
        if (inputs.siteMarkdown && inputs.siteMarkdown.trim().length > 0) {
          scrapedContent = inputs.siteMarkdown;
          console.log(
            `[Phase: analyzing] Using client-provided markdown (${scrapedContent.length} chars) — scrape skipped`,
          );
        } else {
          const scrapeStart = Date.now();
          try {
            const scrapeResponse = await fetch(
              resolveApiUrl('/api/scrape-website'),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
              },
            );
            const scrapeData = (await scrapeResponse.json()) as {
              success: boolean;
              data?: { markdown?: string; content?: string };
            };
            scrapedContent =
              scrapeData?.data?.markdown ?? scrapeData?.data?.content ?? '';
            console.log(
              `[Phase: analyzing] Scrape completed in ${Date.now() - scrapeStart}ms (${scrapedContent.length} chars)`,
            );
          } catch (scrapeErr) {
            throw new Error(
              `Failed to scrape URL: ${
                scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)
              }`,
            );
          }
        }

        if (abortSignal?.aborted) throw new Error('Pipeline aborted: client disconnected');
        const analysisOutput = await analysisHandler.execute(
          { scrapedContent, inputs },
          abortSignal,
        );
        blueprint = analysisOutput.blueprint;
        stateMachine.recordPhaseEnd('analyzing', 'success');
        await emitTokenUsage('analyzing', analysisOutput.tokenUsage);
        console.log(
          `[Phase: analyzing] Analysis phase finished in ${Date.now() - analyzeStart}ms — ` +
          `${blueprint.sections.length} sections, ${analysisOutput.tokenUsage} tokens`,
        );
      }
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

    // Inputs forwarded to every phase handler (brand guidelines are merged in
    // when brand-extension extraction ran during analysis).
    const phaseInputs: PipelineInputs = brandGuidelines
      ? { ...inputs, brandGuidelines }
      : inputs;

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
              return {
                sandboxId: resolvedSandboxId,
                url: null,
                provider: 'e2b' as const,
                createdAt: new Date(),
              };
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
        phaseInputs,
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
            inputs,
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
        console.log(
          `[Phase: progressive_cloning] section "${event.sectionName}" → ${event.status} (${event.overallPercent}%)`,
        );
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
        phaseInputs,
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
      console.log(
        `[Phase: validating] Validation finished — success=${validationResult.success}, ` +
        `errorsFound=${validationResult.errors.length}, retried=${validationResult.retriedFiles.length}, ` +
        `permanentlyFailed=${validationResult.permanentlyFailedFiles.length}, ` +
        `${validationResult.tokenUsage} tokens`,
      );
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
        phaseInputs,
      );

      stateMachine.recordPhaseEnd(
        'polishing',
        polishResult.completedWithWarnings ? 'failure' : 'success',
      );
      await emitTokenUsage('polishing', polishResult.tokenUsage);
      console.log(
        `[Phase: polishing] Polish finished — completed=[${polishResult.passesCompleted.join(', ')}], ` +
        `failed=[${polishResult.passesFailed.join(', ')}], skipped=[${polishResult.passesSkipped.join(', ')}], ` +
        `${polishResult.tokenUsage} tokens`,
      );

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
    console.log(
      `[Phase: complete] Pipeline completed in ${Date.now() - pipelineStart}ms — ` +
      `sandboxUrl=${previewSandboxUrl ?? 'n/a'}, sandboxId=${resolvedSandboxId ?? 'n/a'}, ` +
      `${totalTokenUsage} total tokens, ${sectionResults.filter((r) => r.status === 'complete').length}/${sectionResults.length} sections`,
    );

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
      console.log(`[Edit] Draining ${queuedEdits.length} queued edit(s) after pipeline completion.`);
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
          inputs,
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
  console.log(`[Edit] Processing queued edit ${edit.id}: "${edit.prompt.slice(0, 80)}"`);

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
      '[Edit] Failed to process queued edit:',
      editErr,
    );
  }
}

// ---------------------------------------------------------------------------
// Brand-extension blueprint synthesis
// ---------------------------------------------------------------------------

/**
 * Build a single-section blueprint for brand-extension mode from the
 * guidelines extracted by /api/extract-brand-styles (mirrors the legacy
 * startGeneration brand flow, which generated one requested component).
 */
function buildBrandBlueprint(
  guidelines: Record<string, unknown>,
): SiteBlueprint {
  const branding = guidelines as {
    colors?: {
      primary?: string;
      accent?: string;
      background?: string;
      textPrimary?: string;
    };
    typography?: {
      fontFamilies?: { primary?: string; heading?: string };
      fontSizes?: { h1?: string; h2?: string; body?: string };
    };
  };

  const colors: ColorEntry[] = [];
  const pushColor = (hex: unknown, usage: string): void => {
    if (typeof hex === 'string' && hex.trim()) {
      colors.push({ hex: hex.trim(), usage });
    }
  };
  pushColor(branding.colors?.primary, 'primary');
  pushColor(branding.colors?.accent, 'accent');
  pushColor(branding.colors?.background, 'background');
  pushColor(branding.colors?.textPrimary, 'text');

  const fontFamilies = [
    branding.typography?.fontFamilies?.primary,
    branding.typography?.fontFamilies?.heading,
  ].filter((f): f is string => typeof f === 'string' && f.trim().length > 0);

  const fontSizes = [
    branding.typography?.fontSizes?.h1,
    branding.typography?.fontSizes?.h2,
    branding.typography?.fontSizes?.body,
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  return {
    version: '1.0',
    sections: [{ name: 'custom-component', type: 'features', order: 0 }],
    colors,
    typography: {
      fontFamilies: fontFamilies.length > 0 ? fontFamilies : ['system-ui'],
      fontWeights: [400, 500, 600, 700],
      fontSizes:
        fontSizes.length > 0 ? fontSizes : ['36px', '30px', '16px'],
    },
    images: [],
  };
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
