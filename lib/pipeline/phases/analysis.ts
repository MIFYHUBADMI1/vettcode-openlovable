// lib/pipeline/phases/analysis.ts
// Phase 1: Site Analysis — calls AI to extract a SiteBlueprint from scraped content.

import { BlueprintParser } from '../blueprint-parser';
import { phaseEndpointUrl } from '../phase-endpoint';
import { collectPhaseStream } from '../sse-collect';
import type { SiteBlueprint } from '../types/blueprint';

export interface AnalysisInput {
  scrapedContent: string;
  scrapedMetadata?: Record<string, unknown>;
}

export interface AnalysisOutput {
  blueprint: SiteBlueprint;
  tokenUsage: number;
}

export class AnalysisPhaseHandler {
  /**
   * Execute Phase 1: Site Analysis.
   *
   * Calls the AI generation endpoint with phase="analyze", collects the full
   * SSE response, parses it into a SiteBlueprint via BlueprintParser, and
   * verifies the blueprint can be serialized to JSON (Req 1.6).
   *
   * Timeout: 25 seconds hard limit (Req 1.9).
   * Never returns a partial result — throws on any failure so the caller
   * (PhaseStateMachine) can record a failure outcome and surface the error.
   */
  async execute(input: AnalysisInput, abortSignal?: AbortSignal): Promise<AnalysisOutput> {
    abortSignal?.throwIfAborted();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 25_000);

    // Merge the internal timeout signal with the external abort signal so
    // either one can cancel the fetch (client disconnect or 25 s timeout).
    const mergedSignal = abortSignal
      ? AbortSignal.any([controller.signal, abortSignal])
      : controller.signal;

    let responseText: string;
    let tokenUsage = 0;

    try {
      const response = await fetch(phaseEndpointUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'analyze',
          scrapedContent: input.scrapedContent,
          ...(input.scrapedMetadata ? { scrapedMetadata: input.scrapedMetadata } : {}),
        }),
        signal: mergedSignal,
      });

      if (!response.ok) {
        throw new Error(
          `Analysis request failed with status ${response.status}: ${response.statusText}`,
        );
      }

      // Collect the full SSE stream into a single text buffer.
      const collected = await collectPhaseStream(response);
      responseText = collected.text;
      tokenUsage = collected.tokenUsage;
      if (collected.error && !responseText.trim()) {
        throw new Error(collected.error);
      }
    } catch (err) {
      if (
        err instanceof DOMException && err.name === 'AbortError' ||
        (err instanceof Error && err.message.includes('aborted'))
      ) {
        // Distinguish between client disconnect and internal timeout.
        if (abortSignal?.aborted) {
          throw new Error('Pipeline aborted: client disconnected during analysis');
        }
        throw new Error('Analysis timed out after 25 seconds');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    // --- Parse and validate the blueprint -----------------------------------
    const parseResult = BlueprintParser.parse(responseText);
    if (typeof parseResult === 'string') {
      // BlueprintParser returns a descriptive error string on failure (Req 12.3).
      throw new Error(parseResult);
    }

    const blueprint = parseResult;

    // --- Verify JSON serialization (Req 1.6) --------------------------------
    try {
      const serialized = JSON.stringify(blueprint);
      if (!serialized || serialized.length === 0) {
        throw new Error('Blueprint serialization produced empty output');
      }
    } catch {
      throw new Error('Blueprint serialization failed');
    }

    return { blueprint, tokenUsage };
  }
}
