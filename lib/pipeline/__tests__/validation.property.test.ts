// lib/pipeline/__tests__/validation.property.test.ts
// Property-based tests for ValidationPhaseHandler (Properties 16, 17).
// Feature: progressive-generation-architecture

import { describe, expect, it, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ValidationPhaseHandler } from '../phases/validation';
import {
  MockSandboxProvider,
  installStubbedFetch as stubFetch,
  resetFetch,
  sseErrorResponse,
} from './helpers/mock-sandbox';
import { arbitraryFilePath } from './arbitraries';

const VALID_TS_EXT = /\.(tsx?|jsx?)$/;

/** A file path that extractErrorsFromBuildOutput can recognize. */
const arbitraryErrorFile = (): fc.Arbitrary<string> =>
  arbitraryFilePath().filter((p) => VALID_TS_EXT.test(p));

describe('ValidationPhaseHandler property tests', () => {
  beforeEach(() => {
    resetFetch();
  });

  // Feature: progressive-generation-architecture, Property 16: Validation retry count never exceeds 3 per file
  it('Property 16: Validation retry count never exceeds 3 per file', () => {
    fc.assert(
      fc.asyncProperty(arbitraryErrorFile(), async (filePath) => {
        // Build always fails; AI fix always returns an empty/invalid response.
        const restore = stubFetch(() => sseErrorResponse('mock failure'));
        const sandbox = new MockSandboxProvider();
        sandbox.files[filePath] = 'export const x = 1;';
        sandbox.buildExitCodes = [1, 1, 1, 1]; // initial + 3 re-runs
        sandbox.buildOutput = `${filePath}(10,5): error TS2304: Cannot find name 'foo'`;

        try {
          const result = await new ValidationPhaseHandler().execute(sandbox);

          const failed = result.permanentlyFailedFiles.find(
            (f) => f.filePath === filePath,
          );
          expect(failed).toBeDefined();
          // attemptCount exactly 3 after exhaustion (Req 4.10)
          expect(failed!.attemptCount).toBe(3);
        } finally {
          restore();
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 17: Build error extraction finds all failing files
  it('Property 17: Build error extraction finds all failing files', () => {
    const arbitraryBuildOutput = (): fc.Arbitrary<string> =>
      fc
        .array(
          fc.tuple(arbitraryErrorFile(), fc.integer({ min: 1, max: 200 })),
          { minLength: 1, maxLength: 6 },
        )
        .map((pairs) =>
          pairs
            .map(
              ([path, line]) =>
                `${path}(${line},5): error TS2304: Cannot find name 'x${line}'`,
            )
            .join('\n'),
        );

    fc.assert(
      fc.property(arbitraryBuildOutput(), (output) => {
        const handler = new ValidationPhaseHandler();
        const errors = handler.extractErrorsFromBuildOutput(output);

        // The set of file paths in the output
        const pathsInOutput = new Set(
          output
            .split('\n')
            .filter((l) => l.trim())
            .map((l) => l.match(/^([^\s(]+\.(?:tsx?|jsx?))\(/)?.[1])
            .filter((p): p is string => !!p),
        );

        // At least one ValidationError per unique erroring file path (Req 4.3)
        const errorPaths = new Set(errors.map((e) => e.filePath));
        for (const path of pathsInOutput) {
          expect(errorPaths.has(path)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
