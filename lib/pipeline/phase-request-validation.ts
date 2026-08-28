// lib/pipeline/phase-request-validation.ts
// Pure validation rules for PhaseGenerationRequest (Req 7.1, 7.2).
// Kept in lib/ (free of Next.js server imports) so tests can exercise the
// route's validation logic directly.

import type { SiteBlueprint } from './types/blueprint';

export type GenerationPhase =
  | 'analyze'
  | 'instant_preview'
  | 'progressive_clone'
  | 'polish';

export const VALID_PHASES: GenerationPhase[] = [
  'analyze',
  'instant_preview',
  'progressive_clone',
  'polish',
];

/** Targeted build-fix payload used by the ValidationPhaseHandler (Req 4.4). */
export interface FixRequest {
  filePath: string;
  fileContent: string;
  errorMessage: string;
}

export interface PhaseGenerationRequest {
  phase: GenerationPhase;
  targetSection?: string;
  blueprint?: SiteBlueprint;
  scrapedContent?: string;
  scrapedMetadata?: Record<string, unknown>;
  fixRequest?: FixRequest;
  model?: string;
  sandboxId?: string;
  retryAttempt?: number;
  /** Resolved design style name, embedded in the phase prompt. */
  styleName?: string;
  /** Free-form additional user requirements, embedded in the phase prompt. */
  instructions?: string;
  /** Brand guidelines (brand-extension mode), embedded in the phase prompt. */
  brandGuidelines?: Record<string, unknown>;
}

/**
 * Validate a PhaseGenerationRequest (Req 7.1, 7.2). Returns an error message
 * string when the request is invalid, or null when it is acceptable.
 */
export function validatePhaseRequest(
  body: PhaseGenerationRequest,
): string | null {
  const { phase, targetSection, blueprint } = body;

  if (!phase || !(VALID_PHASES as string[]).includes(phase)) {
    return `Invalid phase "${phase}". Must be one of: ${VALID_PHASES.join(', ')}`;
  }

  if (phase === 'progressive_clone' && !targetSection) {
    return 'targetSection is required when phase is "progressive_clone"';
  }

  if (phase !== 'analyze' && !blueprint) {
    return `blueprint is required when phase is "${phase}"`;
  }

  return null;
}
