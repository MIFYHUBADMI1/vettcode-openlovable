// lib/pipeline/phases/polish.ts
// Phase 5: Polish — runs responsive, spacing, and animation passes to bring
// the cloned site to production quality (Req 5.1 – 5.8).

import { SandboxProvider } from '../../sandbox/types';
import type { SiteBlueprint } from '../types/blueprint';
import type { PipelineInputs } from '../types/pipeline';
import {
  internalApiJsonHeaders,
  phaseEndpointUrl,
  type InternalApiOptions,
} from '../phase-endpoint';
import { collectPhaseStream } from '../sse-collect';
import { parseAIResponse } from '../../file-parser';

export interface PolishResult {
  passesCompleted: string[];
  passesFailed: string[];
  /** Passes that were intentionally not run (e.g. animation, Req 5.5). */
  passesSkipped: string[];
  warnings: string[];
  completedWithWarnings: boolean;
  /**
   * True when critical errors from prior phases (validation / cloning) exist
   * alongside the polish failure. In that case the handler re-throws so the
   * caller can surface the critical errors instead of completing with a warning
   * (Req 5.8).
   */
  hasCriticalErrors: boolean;
  /** Tokens consumed across all polish passes (Req 6.7). */
  tokenUsage: number;
}

export class PolishPhaseHandler {
  constructor(private readonly apiOptions: InternalApiOptions = {}) {}

  /**
   * Execute Phase 5: Polish.
   *
   * Runs three passes in order:
   *  1. responsive — mobile / tablet / desktop breakpoints (Req 5.1-5.2)
   *  2. spacing    — padding, margins, alignment (Req 5.3-5.4)
   *  3. animation  — light animation effects (Req 5.5)
   *
   * On pass failure:
   *  - If `hasCriticalErrors` is true → re-throw so the pipeline surfaces
   *    the critical error rather than completing with a warning (Req 5.8).
   *  - Otherwise → push a warning, set `completedWithWarnings: true`, and
   *    continue to the next pass (Req 5.8).
   *
   * @param blueprint        Site blueprint used to scope AI generation.
   * @param sandboxProvider  Sandbox to write polished files to.
   * @param hasCriticalErrors True when prior phases reported critical failures.
   */
  async execute(
    blueprint: SiteBlueprint,
    sandboxProvider: SandboxProvider,
    hasCriticalErrors?: boolean,
    abortSignal?: AbortSignal,
    inputs?: PipelineInputs,
  ): Promise<PolishResult> {
    if (abortSignal?.aborted) {
      return {
        passesCompleted: [],
        passesFailed: [],
        passesSkipped: [],
        warnings: ['Pipeline aborted before polish phase started'],
        completedWithWarnings: true,
        hasCriticalErrors: hasCriticalErrors ?? false,
        tokenUsage: 0,
      };
    }

    const phaseStart = Date.now();
    console.log(
      `[Phase: polishing] Starting (${blueprint.sections.length} sections, model=${inputs?.model ?? 'default'})`,
    );

    const passes = ['responsive', 'spacing', 'animation'] as const;

    const passesCompleted: string[] = [];
    const passesFailed: string[] = [];
    const passesSkipped: string[] = [];
    const warnings: string[] = [];
    let completedWithWarnings = false;
    let tokenUsage = 0;
    const criticalErrors = hasCriticalErrors ?? false;

    for (const pass of passes) {
      // Bail out early if the client disconnected.
      if (abortSignal?.aborted) {
        console.log('[Phase: polishing] Pipeline aborted — stopping polish passes.');
        break;
      }

      // The animation pass only runs when the original site had animations
      // (Req 5.5). `undefined` means "unknown" → run the pass.
      if (pass === 'animation' && blueprint.hasAnimations === false) {
        console.log(
          '[Phase: polishing] Skipping animation pass — original site had no animations',
        );
        passesSkipped.push(pass);
        continue;
      }

      console.log(`[Phase: polishing] Starting pass: ${pass}`);

      try {
        // Call AI for this polish pass.
        const { files, tokenUsage: passTokens } =
          await this._generatePolishFiles(blueprint, pass, inputs);
        tokenUsage += passTokens;

        // Write any returned files to the sandbox.
        for (const file of files) {
          if (file.path) {
            await sandboxProvider.writeFile(file.path, file.content);
          }
        }

        console.log(`[Phase: polishing] Completed pass: ${pass} (${passTokens} tokens)`);
        passesCompleted.push(pass);
      } catch (err) {
        const errMessage =
          err instanceof Error ? err.message : String(err);

        console.warn(
          `[Phase: polishing] Pass "${pass}" failed: ${errMessage}`,
        );

        passesFailed.push(pass);

        if (criticalErrors) {
          // Critical errors exist alongside this polish failure — re-throw so
          // the caller can surface the real problem (Req 5.8).
          throw err;
        }

        // No critical errors — complete with warning (Req 5.8).
        const warning = `Polish pass "${pass}" failed: ${errMessage}`;
        warnings.push(warning);
        completedWithWarnings = true;
      }
    }

    console.log(
      `[Phase: polishing] Phase complete in ${Date.now() - phaseStart}ms — ` +
      `${passesCompleted.length} passes completed, ${passesFailed.length} failed, ` +
      `${passesSkipped.length} skipped, ${tokenUsage} tokens`,
    );

    return {
      passesCompleted,
      passesFailed,
      passesSkipped,
      warnings,
      completedWithWarnings,
      hasCriticalErrors: criticalErrors,
      tokenUsage,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Call the AI generation endpoint for a specific polish pass and return the
   * parsed files.
   *
   * `targetSection` is reused as the `passType` indicator so the server-side
   * `SystemPromptBuilder` can inject the correct `{passType}` slot value.
   */
  private async _generatePolishFiles(
    blueprint: SiteBlueprint,
    passType: string,
    inputs?: PipelineInputs,
  ): Promise<{
    files: import('../../file-parser').ParsedFile[];
    tokenUsage: number;
  }> {
    const response = await fetch(phaseEndpointUrl(this.apiOptions.baseUrl), {
      method: 'POST',
      headers: internalApiJsonHeaders(this.apiOptions),
      body: JSON.stringify({
        phase: 'polish',
        blueprint,
        targetSection: passType,
        ...(inputs?.model ? { model: inputs.model } : {}),
        ...(inputs?.style ? { styleName: inputs.style } : {}),
        ...(inputs?.instructions ? { instructions: inputs.instructions } : {}),
        ...(inputs?.brandGuidelines ? { brandGuidelines: inputs.brandGuidelines } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Polish pass "${passType}" AI request failed: ${response.status} ${response.statusText}`,
      );
    }

    const collected = await collectPhaseStream(response);
    if (collected.error && !collected.text.trim()) {
      throw new Error(collected.error);
    }

    const { files } = parseAIResponse(collected.text);
    return { files, tokenUsage: collected.tokenUsage };
  }
}
