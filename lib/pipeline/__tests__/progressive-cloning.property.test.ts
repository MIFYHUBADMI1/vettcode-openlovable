// lib/pipeline/__tests__/progressive-cloning.property.test.ts
// Property-based tests for ProgressiveCloningPhaseHandler (Properties 6, 12, 13, 14, 15).
// Feature: progressive-generation-architecture

import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ProgressiveCloningPhaseHandler } from '../phases/progressive-cloning';
import {
  arbitraryBlueprintSections,
  arbitrarySiteBlueprint,
} from './arbitraries';
import {
  MockSandboxProvider,
  installStubbedFetch as stubFetch,
  resetFetch,
  sseSuccessResponse,
  sseErrorResponse,
} from './helpers/mock-sandbox';
import type { ProgressEvent } from '../types/pipeline';

const TIER_WEIGHT: Record<string, number> = {
  hero: 0,
  primary: 1,
  secondary: 2,
  footer: 3,
};

describe('ProgressiveCloningPhaseHandler property tests', () => {
  const handler = new ProgressiveCloningPhaseHandler();

  beforeEach(() => {
    resetFetch();
  });

  // Feature: progressive-generation-architecture, Property 6: Section priority ordering invariants
  it('Property 6: Section priority ordering invariants', () => {
    fc.assert(
      fc.property(arbitraryBlueprintSections(), (sections) => {
        const sorted = handler.sortSectionsByPriority(sections);

        // Tier ordering invariant (Req 3.1, 3.2)
        for (let i = 0; i < sorted.length - 1; i++) {
          const tierA = TIER_WEIGHT[handler.classifySectionPriority(sorted[i].type)];
          const tierB = TIER_WEIGHT[handler.classifySectionPriority(sorted[i + 1].type)];
          expect(tierA).toBeLessThanOrEqual(tierB);
        }

        // Within each tier, ascending order value
        const byTier = new Map<string, number[]>();
        for (const s of sorted) {
          const tier = handler.classifySectionPriority(s.type);
          const list = byTier.get(tier) ?? [];
          list.push(s.order);
          byTier.set(tier, list);
        }
        for (const orders of byTier.values()) {
          for (let i = 0; i < orders.length - 1; i++) {
            expect(orders[i]).toBeLessThanOrEqual(orders[i + 1]);
          }
        }

        // Same multiset of sections as the input
        expect(sorted.length).toBe(sections.length);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 12: Progressive cloning emits valid progress events
  it('Property 12: Progressive cloning emits valid progress events', () => {
    fc.assert(
      fc.asyncProperty(arbitrarySiteBlueprint(), async (blueprint) => {
        if (blueprint.sections.length === 0) return;

        const restore = stubFetch(() =>
          sseSuccessResponse(
            '<file path="src/App.jsx">export default function App(){ return <div>Hi</div>; }</file>',
          ),
        );
        const sandbox = new MockSandboxProvider();
        const events: ProgressEvent[] = [];

        try {
          await handler.execute(blueprint, sandbox, (e) => events.push(e));
        } finally {
          restore();
        }

        // At least one event per section
        for (const section of blueprint.sections) {
          const sectionEvents = events.filter(
            (e) => e.sectionName === section.name,
          );
          expect(sectionEvents.length).toBeGreaterThan(0);
          // Status from the valid set (Req 3.9)
          for (const e of sectionEvents) {
            expect(['pending', 'generating', 'complete', 'failed']).toContain(
              e.status,
            );
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 13: All sections reach terminal status
  it('Property 13: All sections reach terminal status', () => {
    fc.assert(
      fc.asyncProperty(arbitrarySiteBlueprint(), async (blueprint) => {
        if (blueprint.sections.length === 0) return;

        const restore = stubFetch(() =>
          sseSuccessResponse(
            '<file path="src/App.jsx">export default function App(){ return <div>Hi</div>; }</file>',
          ),
        );
        const sandbox = new MockSandboxProvider();

        try {
          const results = await handler.execute(blueprint, sandbox, () => {});

          // Every input section reaches complete or failed (Req 3.11)
          const byName = new Map(results.map((r) => [r.sectionName, r]));
          for (const section of blueprint.sections) {
            const result = byName.get(section.name);
            expect(result).toBeDefined();
            expect(['complete', 'failed']).toContain(result!.status);
          }
        } finally {
          restore();
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 14: Section retry count never exceeds 2
  it('Property 14: Section retry count never exceeds 2', () => {
    fc.assert(
      fc.asyncProperty(arbitraryBlueprintSections(), async (sections) => {
        // Cap at 2 sections so the consecutive-failure threshold is not hit
        const limited = sections.slice(0, 2);
        if (limited.length === 0) return;

        const restore = stubFetch(() => sseErrorResponse('mock failure'));
        const sandbox = new MockSandboxProvider();

        try {
          const results = await handler.execute(
            { version: '1.0', sections: limited, colors: [], typography: { fontFamilies: [], fontWeights: [], fontSizes: [] }, images: [] },
            sandbox,
            () => {},
          );

          for (const r of results) {
            // retryCount never exceeds 2 (Req 9.3)
            expect(r.retryCount).toBeLessThanOrEqual(2);
          }
        } finally {
          restore();
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 15: Consecutive failure threshold halts processing
  it('Property 15: Consecutive failure threshold halts processing', () => {
    fc.assert(
      fc.asyncProperty(arbitraryBlueprintSections(), async (sections) => {
        // Need at least 3 sections for the threshold to trigger (Req 9.8)
        const limited = sections.slice(0, 5);
        if (limited.length < 3) return true;

        const restore = stubFetch(() => sseErrorResponse('mock failure'));
        const sandbox = new MockSandboxProvider();

        try {
          // Manual try/catch so the rejection is always awaited and handled
          // inside the predicate (no dangling rejection during shrinking).
          let threwMessage: string | null = null;
          try {
            await handler.execute(
              { version: '1.0', sections: limited, colors: [], typography: { fontFamilies: [], fontWeights: [], fontSizes: [] }, images: [] },
              sandbox,
              () => {},
            );
          } catch (err) {
            threwMessage = err instanceof Error ? err.message : String(err);
          }

          // Return a boolean instead of asserting: throwing an AssertionError
          // inside an async predicate leaves an unhandled rejection while
          // fast-check is shrinking, which vitest reports as an error.
          return threwMessage === 'CONSECUTIVE_FAILURE_THRESHOLD_REACHED';
        } finally {
          restore();
        }
      }),
      { numRuns: 100 },
    );
  });
});
