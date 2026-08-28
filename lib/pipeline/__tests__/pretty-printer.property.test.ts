// lib/pipeline/__tests__/pretty-printer.property.test.ts
// Property-based tests for PrettyPrinter (Properties 4, 5).
// Feature: progressive-generation-architecture

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { PrettyPrinter } from '../pretty-printer';
import { arbitrarySiteBlueprint } from './arbitraries';

/**
 * Strip the `_*Display` annotation fields that PrettyPrinter embeds so the
 * parsed output can be compared against the canonical SiteBlueprint fields
 * (Req 14.5 — "structurally equivalent").
 */
function stripAnnotations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAnnotations);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('_')) continue;
      out[k] = stripAnnotations(v);
    }
    return out;
  }
  return value;
}

describe('PrettyPrinter property tests', () => {
  // Feature: progressive-generation-architecture, Property 4: Pretty printer output is valid JSON
  it('Property 4: Pretty printer output is valid JSON', () => {
    fc.assert(
      fc.property(arbitrarySiteBlueprint(), (blueprint) => {
        const output = PrettyPrinter.format(blueprint);

        // Output must parse as JSON (Req 14.1)
        const parsed = JSON.parse(output);

        // And must be equivalent to the original blueprint once annotation
        // fields are ignored (Req 14.5)
        expect(stripAnnotations(parsed)).toEqual(blueprint);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 5: Pretty printer escapes special characters
  it('Property 5: Pretty printer escapes special characters', () => {
    const specialChars = fc.stringMatching(/^[a-z0-9_\-.<>\"\\' ]{1,40}$/);

    const trickyBlueprint = fc.record({
      version: fc.constant('1.0' as const),
      sections: fc.array(
        fc.record({
          name: specialChars,
          type: specialChars,
          order: fc.integer({ min: 0, max: 100 }),
        }),
        { minLength: 1, maxLength: 5 },
      ),
      colors: fc.array(
        fc.record({ hex: fc.constant('#FFFFFF' as const) }),
        { minLength: 0, maxLength: 5 },
      ),
      typography: fc.record({
        fontFamilies: fc.array(specialChars, { minLength: 0, maxLength: 3 }),
        fontWeights: fc.array(fc.constant(400 as const), { minLength: 0, maxLength: 3 }),
        fontSizes: fc.array(specialChars, { minLength: 0, maxLength: 3 }),
      }),
      images: fc.array(
        fc.record({
          url: fc.constant('https://example.com/a.png' as const),
          altText: specialChars,
          section: specialChars,
        }),
        { minLength: 0, maxLength: 3 },
      ),
    });

    fc.assert(
      fc.property(trickyBlueprint, (blueprint) => {
        const output = PrettyPrinter.format(blueprint);

        // Escaped output must still be parseable JSON (Req 14.6)
        const parsed = JSON.parse(output);
        expect(stripAnnotations(parsed)).toEqual(blueprint);
      }),
      { numRuns: 100 },
    );
  });
});
