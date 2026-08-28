import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ProgressiveCloningPhaseHandler } from '../phases/progressive-cloning';
import { arbitraryBlueprintSections } from './arbitraries';
import {
  MockSandboxProvider,
  installStubbedFetch as stubFetch,
  resetFetch,
  sseErrorResponse,
} from './helpers/mock-sandbox';

describe('repro15b', () => {
  const handler = new ProgressiveCloningPhaseHandler();
  beforeEach(() => {
    resetFetch();
  });

  it('Property 15 with failing seed', () => {
    fc.assert(
      fc.asyncProperty(arbitraryBlueprintSections(), async (sections) => {
        const limited = sections.slice(0, 5);
        if (limited.length < 3) return true;

        const restore = stubFetch(() => sseErrorResponse('mock failure'));
        const sandbox = new MockSandboxProvider();

        try {
          let threwMessage: string | null = null;
          try {
            await handler.execute(
              {
                version: '1.0',
                sections: limited,
                colors: [],
                typography: { fontFamilies: [], fontWeights: [], fontSizes: [] },
                images: [],
              },
              sandbox,
              () => {},
            );
          } catch (err) {
            threwMessage = err instanceof Error ? err.message : String(err);
          }

          return threwMessage === 'CONSECUTIVE_FAILURE_THRESHOLD_REACHED';
        } finally {
          restore();
        }
      }),
      { numRuns: 200, seed: -782092438 },
    );
  });
});
