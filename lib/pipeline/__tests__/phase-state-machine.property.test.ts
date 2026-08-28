// lib/pipeline/__tests__/phase-state-machine.property.test.ts
// Property-based tests for PhaseStateMachine (Properties 7, 8, 9).
// Feature: progressive-generation-architecture

import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { PhaseStateMachine } from '../phase-state-machine';
import type { PhaseState, PhaseTransitionEvent } from '../types/pipeline';
import { arbitraryPhaseState } from './arbitraries';

const VALID_STATES: PhaseState[] = [
  'idle',
  'analyzing',
  'instant_preview',
  'progressive_cloning',
  'validating',
  'polishing',
  'complete',
  'error',
];

// Legal transition map mirroring the state diagram (design.md)
const LEGAL: Record<PhaseState, PhaseState[]> = {
  idle: ['analyzing'],
  analyzing: ['instant_preview', 'error'],
  instant_preview: ['progressive_cloning'],
  progressive_cloning: ['validating', 'error'],
  validating: ['polishing', 'validating', 'error'],
  polishing: ['complete'],
  error: ['analyzing', 'idle'],
  complete: [],
};

describe('PhaseStateMachine property tests', () => {
  // Feature: progressive-generation-architecture, Property 7: Phase state is always from the valid set
  it('Property 7: Phase state is always from the valid set', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryPhaseState(), { minLength: 0, maxLength: 8 }),
        arbitraryPhaseState(),
        (sequence, start) => {
          const machine = new PhaseStateMachine();
          let current: PhaseState = 'idle';

          // Apply every valid transition in the sequence
          for (const target of sequence) {
            const allowed: PhaseState[] = LEGAL[current];
            if (allowed.includes(target)) {
              machine.transition(target);
              current = target;
            }
          }

          // State is always one of the eight defined states (Req 6.1)
          expect(VALID_STATES).toContain(machine.getState());
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 8: Phase transition events always carry timestamp and metadata
  it('Property 8: Phase transition events always carry timestamp and metadata', () => {
    fc.assert(
      fc.property(arbitraryPhaseState(), (start) => {
        const machine = new PhaseStateMachine();
        const events: PhaseTransitionEvent[] = [];

        machine.on('transition', (evt: PhaseTransitionEvent) => {
          events.push(evt);
        });

        // Walk a legal chain of transitions
        let current: PhaseState = 'idle';
        let steps = 0;
        while (steps < 6) {
          const options: PhaseState[] = LEGAL[current];
          if (options.length === 0) break;
          const next: PhaseState = options[steps % options.length];
          machine.transition(next, { attempt: steps });
          current = next;
          steps++;
          if (current === 'complete') break;
        }

        expect(events.length).toBeGreaterThan(0);

        for (const evt of events) {
          // timestamp is a positive number (Req 6.2)
          expect(evt.timestamp).toBeGreaterThan(0);
          // metadata is a non-null object (Req 6.2)
          expect(evt.metadata).toBeDefined();
          expect(evt.metadata).not.toBeNull();
          expect(typeof evt.metadata).toBe('object');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: progressive-generation-architecture, Property 9: Every completed phase has a log entry
  it('Property 9: Every completed phase has a log entry', () => {
    fc.assert(
      fc.property(arbitraryPhaseState(), () => {
        const machine = new PhaseStateMachine();

        // Simulate phases: start → end (success) for a few legal phases
        const phasesToRun: PhaseState[] = [
          'analyzing',
          'instant_preview',
          'progressive_cloning',
          'validating',
        ];

        for (const phase of phasesToRun) {
          machine.recordPhaseStart(phase);
          machine.recordPhaseEnd(phase, 'success');
        }

        const ctx = machine.getContext();

        for (const phase of phasesToRun) {
          const entry = ctx.executionLog.find((e) => e.phase === phase);
          expect(entry).toBeDefined();
          // startTime and endTime non-null (Req 6.3)
          expect(entry!.startTime).not.toBeNull();
          expect(entry!.endTime).not.toBeNull();
          expect(entry!.endTime!).toBeGreaterThanOrEqual(entry!.startTime);
          // outcome defined (Req 6.5)
          expect(['success', 'failure']).toContain(entry!.outcome);
        }
      }),
      { numRuns: 100 },
    );
  });
});
