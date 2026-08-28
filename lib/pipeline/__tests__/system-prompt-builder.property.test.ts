// lib/pipeline/__tests__/system-prompt-builder.property.test.ts
// Property-based tests for SystemPromptBuilder + phase request validation
// (Properties 10, 11).
// Feature: progressive-generation-architecture

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { SystemPromptBuilder } from '../system-prompt-builder';
import { validatePhaseRequest } from '../phase-request-validation';
import { arbitrarySiteBlueprint, arbitraryBlueprintSections } from './arbitraries';

const VALID_PHASES = [
  'analyze',
  'instant_preview',
  'progressive_clone',
  'polish',
] as const;

describe('SystemPromptBuilder property tests', () => {
  // Feature: progressive-generation-architecture, Property 10: AI generation endpoint rejects invalid phase values
  it('Property 10: AI generation endpoint rejects invalid phase values', () => {
    // Arbitrary strings that are NOT valid phase values
    const invalidPhase = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => !(VALID_PHASES as readonly string[]).includes(s));

    fc.assert(
      fc.property(
        invalidPhase,
        arbitrarySiteBlueprint(),
        arbitraryBlueprintSections(),
        (badPhase, blueprint, sections) => {
          const targetSection = sections[0]?.name ?? 'hero-section';

          // Any invalid phase → 4xx (Req 7.1)
          expect(
            validatePhaseRequest({
              phase: badPhase as never,
              blueprint,
              targetSection,
            }),
          ).not.toBeNull();

          // Valid phases with a complete request are not rejected solely on phase
          for (const phase of VALID_PHASES) {
            const result = validatePhaseRequest({
              phase,
              blueprint: phase === 'analyze' ? undefined : blueprint,
              targetSection: phase === 'progressive_clone' ? targetSection : undefined,
            });
            expect(result).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 11: System prompt contains phase name
  it('Property 11: System prompt contains phase name', () => {
    fc.assert(
      fc.property(arbitraryBlueprintSections(), (sections) => {
        const targetSection = sections[0]?.name ?? 'hero-section';

        for (const phase of VALID_PHASES) {
          const prompt = SystemPromptBuilder.build(
            phase,
            phase === 'progressive_clone' ? targetSection : undefined,
            phase === 'polish' ? 'spacing' : undefined,
          );

          // Prompt contains the phase name (Req 7.3)
          expect(prompt).toContain(phase);

          // When targetSection is provided, the prompt contains the section name
          // (Req 7.4)
          if (phase === 'progressive_clone') {
            expect(prompt).toContain(targetSection);
          }

          // When passType is provided for polish, the prompt contains it (Req 7.5)
          if (phase === 'polish') {
            expect(prompt).toContain('spacing');
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
