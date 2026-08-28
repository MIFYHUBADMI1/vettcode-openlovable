// lib/pipeline/system-prompt-builder.ts
// Builds phase-specific system prompts by selecting the correct template and
// interpolating runtime slots ({targetSection}, {passType}).

import { ANALYZE_PROMPT } from "./prompts/analyze.prompt";
import { INSTANT_PREVIEW_PROMPT } from "./prompts/instant-preview.prompt";
import { PROGRESSIVE_CLONE_PROMPT } from "./prompts/progressive-clone.prompt";
import { POLISH_PROMPT } from "./prompts/polish.prompt";
import { VALIDATION_FIX_PROMPT } from "./prompts/validation-fix.prompt";

/**
 * The four externally-visible generation phases, matching the
 * PhaseGenerationRequest.phase discriminant (Req 7.1).
 */
export type GenerationPhase =
  | "analyze"
  | "instant_preview"
  | "progressive_clone"
  | "polish";

/** Internal helper type that also admits the validation-fix pseudo-phase. */
type AllPhases = GenerationPhase | "validation_fix";

export class SystemPromptBuilder {
  /**
   * Build a system prompt for the given phase.
   *
   * @param phase          - The generation phase.
   * @param targetSection  - Required when phase === "progressive_clone".
   *                         The returned prompt will contain this section name (Req 7.4).
   * @param passType       - Optional when phase === "polish".
   *                         The returned prompt will contain this pass type (Req 7.5).
   *
   * @returns The full system prompt string. The string always contains the
   *          phase name (Req 7.3) and, when targetSection is supplied, also
   *          contains the targetSection value (Req 7.4).
   */
  static build(
    phase: GenerationPhase,
    targetSection?: string,
    passType?: string,
  ): string {
    switch (phase) {
      case "analyze":
        return ANALYZE_PROMPT;

      case "instant_preview":
        return INSTANT_PREVIEW_PROMPT;

      case "progressive_clone": {
        const section = targetSection ?? "unknown-section";
        // Replace every occurrence of the {targetSection} slot with the real value.
        return PROGRESSIVE_CLONE_PROMPT.replaceAll("{targetSection}", section);
      }

      case "polish": {
        const pass = passType ?? "responsive";
        // Replace every occurrence of the {passType} slot with the real value.
        return POLISH_PROMPT.replaceAll("{passType}", pass);
      }

      default: {
        // TypeScript exhaustiveness guard — this branch is unreachable at runtime
        // for well-typed callers, but we keep it to satisfy the compiler when the
        // switch is over a union that may be widened in future.
        const _exhaustive: never = phase;
        throw new Error(
          `SystemPromptBuilder.build: unknown phase "${_exhaustive as string}"`,
        );
      }
    }
  }

  /**
   * Convenience overload for the internal validation-fix pseudo-phase.
   * Not part of the public GenerationPhase union but useful when the
   * ValidationPhaseHandler needs a prompt without going through the
   * generate-ai-phase endpoint.
   */
  static buildValidationFix(): string {
    return VALIDATION_FIX_PROMPT;
  }
}
