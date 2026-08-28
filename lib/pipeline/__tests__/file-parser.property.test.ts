// lib/pipeline/__tests__/file-parser.property.test.ts
// Property-based tests for parseAIResponse progressive extraction (Properties 18, 19).
// Feature: progressive-generation-architecture

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { parseAIResponse } from '../../file-parser';
import { arbitraryFilePath } from './arbitraries';

describe('FileParser property tests', () => {
  // Feature: progressive-generation-architecture, Property 18: File parser prefers longer complete version on duplicate
  it('Property 18: File parser prefers longer complete version on duplicate', () => {
    const shortContent = fc.stringMatching(/^[A-Za-z0-9 ]{5,20}$/);
    const longContent = fc
      .stringMatching(/^[A-Za-z0-9 ]{21,100}$/)
      .filter((s) => s.length > 20);

    fc.assert(
      fc.property(
        arbitraryFilePath(),
        shortContent,
        longContent,
        (filePath, shortC, longC) => {
          // Guard: parseAIResponse trims content before comparing lengths,
          // so the TRIM of longContent must be strictly longer than the TRIM
          // of shortContent for "longer wins" to hold deterministically.
          if (longC.trim().length <= shortC.trim().length) return;

          const response = [
            `<file path="${filePath}">${shortC}</file>`,
            `<file path="${filePath}">${longC}</file>`,
          ].join('\n');

          const { files } = parseAIResponse(response);
          const match = files.find((f) => f.path === filePath);

          expect(match).toBeDefined();
          // Longer content wins on duplicate (Req 13.2, 13.3).
          // parseAIResponse trims file content, so compare trimmed values.
          expect(match!.content.trim()).toBe(longC.trim());
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 19: Ellipsis stripping does not remove spread operators
  it('Property 19: Ellipsis stripping does not remove spread operators', () => {
    const identifier = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,15}$/);
    const filler = fc.array(fc.stringMatching(/^[a-z0-9 (),;{}]+$/), {
      minLength: 0,
      maxLength: 4,
    });

    fc.assert(
      fc.property(
        arbitraryFilePath(),
        identifier,
        fc.array(identifier, { minLength: 1, maxLength: 4 }),
        filler,
        (filePath, spreadTarget, spreadProps, lines) => {
          const spreadOperators = spreadProps.map((p) => `...${p}`);
          const standaloneEllipsis = ['...', '   ...', '\t...'];
          const content = [
            ...lines,
            ...spreadOperators,
            ...standaloneEllipsis,
          ].join('\n');

          const response = `<file path="${filePath}">${content}</file>`;
          const { files } = parseAIResponse(response);
          const match = files.find((f) => f.path === filePath);

          expect(match).toBeDefined();

          const resultContent = match!.content;

          // Every spread operator survives (Req 13.7)
          for (const op of spreadOperators) {
            expect(resultContent).toContain(op);
          }

          // Standalone ellipsis lines are removed (Req 13.7)
          for (const el of standaloneEllipsis) {
            expect(resultContent.split('\n')).not.toContain(el.trim());
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
