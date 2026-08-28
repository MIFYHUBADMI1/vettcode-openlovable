// lib/pipeline/phases/progressive-cloning.ts
// Phase 3: Progressive Cloning — generates each section individually in
// priority order, writes files with hot reload, and emits progress events
// (Req 3.1 – 3.12, 9.1 – 9.8).

import { SandboxProvider } from '../../sandbox/types';
import type { SiteBlueprint, BlueprintSection } from '../types/blueprint';
import type { SectionPriority, SectionResult, ProgressEvent } from '../types/pipeline';
import { ProgressiveFileApplicationService } from '../progressive-file-application';
import { phaseEndpointUrl } from '../phase-endpoint';
import { collectPhaseStream } from '../sse-collect';
import { parseAIResponse } from '../../file-parser';

/** Numeric weight for each priority tier — lower means higher priority. */
const TIER_ORDER: Record<SectionPriority, number> = {
  hero: 0,
  primary: 1,
  secondary: 2,
  footer: 3,
};

export class ProgressiveCloningPhaseHandler {
  /**
   * Map a section `type` string to a `SectionPriority` tier (Req 3.1).
   */
  classifySectionPriority(sectionType: string): SectionPriority {
    switch (sectionType.toLowerCase()) {
      case 'hero':
        return 'hero';
      case 'features':
      case 'pricing':
      case 'services':
      case 'products':
        return 'primary';
      case 'testimonials':
      case 'team':
      case 'gallery':
      case 'blog':
        return 'secondary';
      case 'footer':
        return 'footer';
      default:
        return 'secondary';
    }
  }

  /**
   * Sort sections into priority order (Req 3.1, 3.2):
   *   hero → primary → secondary → footer
   * Within each tier, sections are sorted by ascending `order` value.
   *
   * Returns a new array; does not mutate the input.
   */
  sortSectionsByPriority(sections: BlueprintSection[]): BlueprintSection[] {
    return [...sections].sort((a, b) => {
      const tierA = TIER_ORDER[this.classifySectionPriority(a.type)];
      const tierB = TIER_ORDER[this.classifySectionPriority(b.type)];
      if (tierA !== tierB) return tierA - tierB;
      // Same tier — sort by blueprint order.
      return a.order - b.order;
    });
  }

  /**
   * Execute Phase 3: Progressive Cloning.
   *
   * For each section (sorted by priority):
   *  - Emit `generating` progress event.
   *  - Call AI (45 s timeout per section, Req 3.5).
   *  - Retry up to 2 times on failure (Req 9.3).
   *  - Write files with hot reload on success (Req 3.4, 3.6).
   *  - Track consecutive failures; throw when ≥ 3 (Req 9.8).
   *  - Emit `complete` or `failed` progress event.
   *
   * @param blueprint       The site blueprint produced by Phase 1.
   * @param sandboxProvider Sandbox to write files to.
   * @param onProgress      Callback fired on every section status change.
   * @returns Array of SectionResult, one per section.
   */
  async execute(
    blueprint: SiteBlueprint,
    sandboxProvider: SandboxProvider,
    onProgress: (event: ProgressEvent) => void,
    abortSignal?: AbortSignal,
  ): Promise<SectionResult[]> {
    abortSignal?.throwIfAborted();

    const sortedSections = this.sortSectionsByPriority(blueprint.sections);
    const totalCount = sortedSections.length;
    const results: SectionResult[] = [];
    const fileService = new ProgressiveFileApplicationService();

    let consecutiveFailures = 0;
    let completedCount = 0;

    for (const section of sortedSections) {
      // Check for client disconnect before starting a new section.
      if (abortSignal?.aborted) {
        console.log('[ProgressiveCloning] Pipeline aborted — stopping section generation.');
        break;
      }

      const priority = this.classifySectionPriority(section.type);

      // Emit "generating" event at the start of each section.
      onProgress({
        type: 'section_status',
        sectionName: section.name,
        status: 'generating',
        overallPercent: Math.round((completedCount / totalCount) * 100),
        timestamp: Date.now(),
      });

      let sectionStatus: 'complete' | 'failed' = 'failed';
      let retryCount = 0;
      let lastError: string | undefined;
      let sectionTokenUsage = 0;

      // Attempt generation with up to 2 retries (3 attempts total, Req 9.3).
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const { files, tokenUsage } = await this._generateSection(
            blueprint,
            section.name,
            attempt,
            abortSignal,
          );

          sectionTokenUsage += tokenUsage;

          // Write files with hot reload (isProgressive: true triggers HMR, Req 3.4).
          await fileService.applyFiles(files, sandboxProvider, {
            isProgressive: true,
            sectionName: section.name,
          });

          sectionStatus = 'complete';
          retryCount = attempt;
          lastError = undefined;
          break;
        } catch (err) {
          lastError =
            err instanceof Error ? err.message : String(err);
          retryCount = attempt;
          console.warn(
            `[ProgressiveCloning] Section "${section.name}" attempt ${attempt + 1} failed:`,
            lastError,
          );
          // Loop continues for next retry attempt.
        }
      }

      if (sectionStatus === 'complete') {
        consecutiveFailures = 0;
        completedCount++;
      } else {
        consecutiveFailures++;
      }

      const overallPercent = Math.round((completedCount / totalCount) * 100);

      onProgress({
        type: 'section_status',
        sectionName: section.name,
        status: sectionStatus,
        overallPercent,
        timestamp: Date.now(),
      });

      results.push({
        sectionName: section.name,
        priority,
        status: sectionStatus,
        retryCount,
        ...(lastError ? { error: lastError } : {}),
        tokenUsage: sectionTokenUsage,
      });

      // Consecutive failure threshold (Req 9.8).
      if (consecutiveFailures >= 3) {
        throw new Error('CONSECUTIVE_FAILURE_THRESHOLD_REACHED');
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Call the AI generation endpoint for a single section with a 45-second
   * timeout (Req 3.5). `attempt` is forwarded so retries use a modified,
   * stricter prompt (Req 9.3).
   */
  private async _generateSection(
    blueprint: SiteBlueprint,
    sectionName: string,
    attempt = 0,
    abortSignal?: AbortSignal,
  ): Promise<{
    files: import('../../file-parser').ParsedFile[];
    tokenUsage: number;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000);

    // Merge the internal timeout signal with the external abort signal so
    // either one can cancel the fetch (client disconnect or 45 s timeout).
    const mergedSignal = abortSignal
      ? AbortSignal.any([controller.signal, abortSignal])
      : controller.signal;

    try {
      const response = await fetch(phaseEndpointUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: 'progressive_clone',
          blueprint,
          targetSection: sectionName,
          retryAttempt: attempt,
        }),
        signal: mergedSignal,
      });

      if (!response.ok) {
        throw new Error(
          `Section generation request failed: ${response.status} ${response.statusText}`,
        );
      }

      const collected = await collectPhaseStream(response);
      if (collected.error && !collected.text.trim()) {
        throw new Error(collected.error);
      }

      const { files } = parseAIResponse(collected.text);
      if (files.length === 0) {
        throw new Error(
          `Section generation for "${sectionName}" returned no files`,
        );
      }

      return { files, tokenUsage: collected.tokenUsage };
    } catch (err) {
      if (
        err instanceof DOMException && err.name === 'AbortError' ||
        (err instanceof Error && err.message.includes('aborted'))
      ) {
        if (abortSignal?.aborted) {
          throw new Error(`Pipeline aborted: client disconnected during section "${sectionName}"`);
        }
        throw new Error(
          `Section generation for "${sectionName}" timed out after 45 seconds`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
