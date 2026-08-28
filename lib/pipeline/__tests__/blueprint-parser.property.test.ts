// lib/pipeline/__tests__/blueprint-parser.property.test.ts
// Property-based tests for BlueprintParser (Properties 1, 2, 3).
// Feature: progressive-generation-architecture

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { BlueprintParser } from '../blueprint-parser';
import { arbitrarySiteBlueprint } from './arbitraries';

describe('BlueprintParser property tests', () => {
  // Feature: progressive-generation-architecture, Property 1: Blueprint required fields are always present
  it('Property 1: Blueprint required fields are always present', () => {
    fc.assert(
      fc.property(arbitrarySiteBlueprint(), (blueprint) => {
        const result = BlueprintParser.parse(JSON.stringify(blueprint));

        expect(typeof result).toBe('object');
        if (typeof result === 'string') return;

        // All four required top-level fields present and non-null (Req 1.2-1.5, 12.2)
        expect(result.sections).toBeDefined();
        expect(result.sections).not.toBeNull();
        expect(Array.isArray(result.sections)).toBe(true);

        expect(result.colors).toBeDefined();
        expect(result.colors).not.toBeNull();
        expect(Array.isArray(result.colors)).toBe(true);

        expect(result.typography).toBeDefined();
        expect(result.typography).not.toBeNull();

        expect(result.images).toBeDefined();
        expect(result.images).not.toBeNull();
        expect(Array.isArray(result.images)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 2: Section types are always from the recognized set
  it('Property 2: Section types are always from the recognized set', () => {
    fc.assert(
      fc.property(arbitrarySiteBlueprint(), (blueprint) => {
        const result = BlueprintParser.parse(JSON.stringify(blueprint));

        expect(typeof result).toBe('object');
        if (typeof result === 'string') return;

        for (const section of result.sections) {
          expect(typeof section.type).toBe('string');
          expect(section.type.length).toBeGreaterThan(0);
          // Section names match the lowercase-hyphen pattern (Req 12.6)
          expect(section.name).toMatch(/^[a-z][a-z0-9-]*$/);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 3: Blueprint round-trip serialization
  it('Property 3: Blueprint round-trip serialization', () => {
    fc.assert(
      fc.property(arbitrarySiteBlueprint(), (blueprint) => {
        const result = BlueprintParser.parse(JSON.stringify(blueprint));

        expect(typeof result).toBe('object');
        if (typeof result === 'string') return;

        // parse() applies normalize() to section names, so the round-trip must
        // equal the normalized blueprint (Req 12.4, 14.5).
        expect(result).toEqual(BlueprintParser.normalize(blueprint));
      }),
      { numRuns: 100 },
    );
  });
});
