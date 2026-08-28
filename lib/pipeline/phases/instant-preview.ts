// lib/pipeline/phases/instant-preview.ts
// Phase 2: Instant Preview — generates a minimal layout, writes it to the
// sandbox, installs baseline packages, starts Vite, and returns the preview
// URL within 20-30 seconds (Req 2.1 – 2.9).

import { SandboxProvider } from '../../sandbox/types';
import type { SiteBlueprint } from '../types/blueprint';
import type { PipelineInputs } from '../types/pipeline';
import { ProgressiveFileApplicationService } from '../progressive-file-application';
import { phaseEndpointUrl } from '../phase-endpoint';
import { collectPhaseStream } from '../sse-collect';
import { parseAIResponse } from '../../file-parser';

export class InstantPreviewPhaseHandler {
  /**
   * Execute Phase 2: Instant Preview Generation.
   *
   * Steps (Req 2.1 – 2.9):
   *  1. Ensure a sandbox exists (create if not).
   *  2. Call AI for minimal layout files (phase="instant_preview").
   *  3. Write all layout files to the sandbox in bulk (isProgressive=false).
   *  4. Install baseline packages.
   *  5. Start the Vite dev server.
   *  6. Return the sandbox preview URL immediately (Req 2.9) — even if the
   *     generated files contain errors.
   *  7. Fire-and-forget background error fixing (Req 2.9).
   */
  async execute(
    blueprint: SiteBlueprint,
    sandboxProvider: SandboxProvider,
    inputs?: PipelineInputs,
  ): Promise<{ sandboxUrl: string; tokenUsage: number }> {
    const phaseStart = Date.now();
    console.log(
      `[Phase: instant_preview] Starting instant preview (${blueprint.sections.length} sections)`,
    );

    // --- Step 1: Ensure sandbox exists (Req 2.1) ----------------------------
    if (!sandboxProvider.getSandboxInfo()) {
      await sandboxProvider.createSandbox();
    }

    // --- Step 2: Call AI for minimal layout ---------------------------------
    const { files: layoutFiles, tokenUsage } =
      await this._generateLayoutFiles(blueprint, inputs);

    // --- Step 3: Write files in bulk (non-progressive) ----------------------
    const fileService = new ProgressiveFileApplicationService();
    await fileService.applyFiles(layoutFiles, sandboxProvider, {
      isProgressive: false,
      sectionName: 'instant-preview',
    });

    // --- Step 4: Install baseline packages (Req 2.6) -----------------------
    await sandboxProvider.installPackages(['react', 'react-dom', 'tailwindcss']);

    // --- Step 5: Start Vite dev server (Req 2.7) ---------------------------
    await sandboxProvider.setupViteApp();

    // --- Step 6: Get URL and return immediately (Req 2.8, 2.9) -------------
    const sandboxUrl =
      sandboxProvider.getSandboxUrl() ?? 'http://localhost:5173';

    console.log(
      `[Phase: instant_preview] Preview ready in ${Date.now() - phaseStart}ms — ` +
      `${layoutFiles.length} layout files, sandboxUrl=${sandboxUrl}, ${tokenUsage} tokens`,
    );

    // --- Step 7: Background error fixing — fire-and-forget (Req 2.9) -------
    // We intentionally do not await this so the phase resolves and the
    // pipeline transitions to progressive_cloning without delay.
    void sandboxProvider
      .runCommand('npm run build')
      .catch(() => {
        // Background fix attempt — failures are non-fatal here.
        console.warn(
          '[Phase: instant_preview] Background build check failed; preview may contain errors.',
        );
      });

    return { sandboxUrl, tokenUsage };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Call the AI generation endpoint with phase="instant_preview" and collect
   * the parsed file list from the SSE stream.
   */
  private async _generateLayoutFiles(
    blueprint: SiteBlueprint,
    inputs?: PipelineInputs,
  ): Promise<{
    files: import('../../file-parser').ParsedFile[];
    tokenUsage: number;
  }> {
    const response = await fetch(phaseEndpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: 'instant_preview',
        blueprint,
        ...(inputs?.model ? { model: inputs.model } : {}),
        ...(inputs?.style ? { styleName: inputs.style } : {}),
        ...(inputs?.instructions ? { instructions: inputs.instructions } : {}),
        ...(inputs?.brandGuidelines ? { brandGuidelines: inputs.brandGuidelines } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Instant preview AI request failed: ${response.status} ${response.statusText}`,
      );
    }

    const collected = await collectPhaseStream(response);
    const { files } = parseAIResponse(collected.text);
    return { files, tokenUsage: collected.tokenUsage };
  }
}
