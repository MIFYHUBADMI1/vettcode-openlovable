'use client';

// components/app/ProgressUI.tsx
// Progress panel for the Progressive Generation pipeline (Req 10.1 – 10.7).
//
// - Maps each PhaseState to a user-facing label (Req 10.1)
// - Renders per-section rows during progressive_cloning (Req 10.2, 10.3)
// - Renders an overall progress bar derived from SectionStatusPayload.overallPercent
// - Estimates remaining time from historical phase durations in executionLog
// - Animate completion indicator when a section transitions to complete
// - Shows error rows for failed sections (Req 10.6)
// - Expandable per-phase detail panels showing execution-log entries and
//   token usage together in the same panel (Req 10.7)

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  PhaseState,
  PhaseExecutionLog,
  SectionStatus,
} from '@/lib/pipeline/types';

// ---------------------------------------------------------------------------
// Phase labels (Req 10.1)
// ---------------------------------------------------------------------------

const PHASE_LABELS: Partial<Record<PhaseState, string>> = {
  analyzing: 'Analyzing',
  instant_preview: 'Generating Preview',
  progressive_cloning: 'Cloning Sections',
  validating: 'Validating',
  polishing: 'Polishing',
};

const PHASE_ORDER: PhaseState[] = [
  'analyzing',
  'instant_preview',
  'progressive_cloning',
  'validating',
  'polishing',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProgressErrorRow {
  sectionName: string;
  errorType: string;
}

export interface ProgressUIProps {
  /** Current pipeline phase — drives which phase row is active. */
  currentPhase: PhaseState;
  /** Per-section status during progressive cloning (Req 10.2). */
  sectionStatuses: Record<string, SectionStatus>;
  /** Overall completion 0–100 (Req 10.3). */
  overallPercent: number;
  /** Execution log for duration estimates and expandable details (Req 10.4, 10.7). */
  executionLog: PhaseExecutionLog[];
  /** Per-phase token usage, keyed by phase name (Req 10.7). */
  tokenUsageByPhase?: Record<string, number>;
  /** Section errors to display (Req 10.6). */
  errors?: ProgressErrorRow[];
  /** Timestamp (ms) of the pipeline start for time estimates. */
  startedAt?: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function formatClock(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

function StatusIcon({ status }: { status: SectionStatus }) {
  switch (status) {
    case 'complete':
      return (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"
          data-status-icon="complete"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 111.4-1.4l2.8 2.79 6.8-6.8a1 1 0 011.4 0z"
              clipRule="evenodd"
            />
          </svg>
        </motion.span>
      );
    case 'failed':
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path
              fillRule="evenodd"
              d="M10 8.586l-3.293-3.293a1 1 0 10-1.414 1.414L8.586 10l-3.293 3.293a1 1 0 101.414 1.414L10 11.414l3.293 3.293a1 1 0 001.414-1.414L11.414 10l3.293-3.293a1 1 0 00-1.414-1.414L10 8.586z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      );
    case 'generating':
      return (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="inline-block h-4 w-4 rounded-full border-2 border-sky-500 border-t-transparent"
          data-status-icon="generating"
        />
      );
    case 'pending':
    default:
      return (
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" />
      );
  }
}

function PhaseRowStatusDot({ phase, currentPhase }: { phase: PhaseState; currentPhase: PhaseState }) {
  if (phase === currentPhase) {
    return (
      <motion.span
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="inline-block h-2 w-2 rounded-full bg-sky-500"
      />
    );
  }

  const order = PHASE_ORDER.indexOf(phase);
  const currentOrder = PHASE_ORDER.indexOf(currentPhase);
  const completed = order < currentOrder || currentPhase === 'complete';

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        completed ? 'bg-emerald-500' : 'bg-gray-300'
      }`}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProgressUI({
  currentPhase,
  sectionStatuses,
  overallPercent,
  executionLog,
  tokenUsageByPhase = {},
  errors = [],
  startedAt,
}: ProgressUIProps) {
  const [expandedPhase, setExpandedPhase] = useState<PhaseState | null>(null);

  // Estimated remaining time derived from historical phase durations (Req 10.4).
  const estimatedRemaining = useMemo(() => {
    const completedPhases = executionLog.filter((e) => e.endTime != null);
    if (completedPhases.length === 0) return null;

    const avgDuration =
      completedPhases.reduce((sum, e) => {
        const d = (e.endTime ?? 0) - e.startTime;
        return sum + (d > 0 ? d : 0);
      }, 0) / completedPhases.length;

    const remaining = PHASE_ORDER.filter(
      (p) => p !== currentPhase,
    ).length;
    return Math.round(avgDuration * Math.max(remaining, 0));
  }, [executionLog, currentPhase]);

  const phaseRows = PHASE_ORDER.map((phase) => {
    const logEntries = executionLog.filter((e) => e.phase === phase);
    const tokenUsage = tokenUsageByPhase[phase] ?? 0;
    const isExpanded = expandedPhase === phase;
    const isCurrent = phase === currentPhase;

    return (
      <div key={phase} className="border-b border-gray-100 last:border-b-0">
        <button
          type="button"
          onClick={() => setExpandedPhase(isExpanded ? null : phase)}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
          data-phase-row={phase}
        >
          <span className="flex items-center gap-2.5">
            <PhaseRowStatusDot phase={phase} currentPhase={currentPhase} />
            <span
              className={`text-sm font-medium ${
                isCurrent ? 'text-gray-900' : 'text-gray-600'
              }`}
            >
              {PHASE_LABELS[phase] ?? phase}
            </span>
          </span>

          <span className="flex items-center gap-2 text-xs text-gray-400">
            {tokenUsage > 0 && <span>{tokenUsage.toLocaleString()} tok</span>}
            <motion.svg
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z"
                clipRule="evenodd"
              />
            </motion.svg>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3">
                {/* Execution log + token usage in the SAME panel (Req 10.7) */}
                {logEntries.length === 0 && tokenUsage === 0 ? (
                  <p className="text-xs text-gray-400">No data recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {logEntries.map((entry, idx) => {
                      const duration =
                        entry.endTime != null
                          ? entry.endTime - entry.startTime
                          : null;
                      return (
                        <div
                          key={`${entry.phase}-${idx}`}
                          className="rounded-md bg-gray-50 px-3 py-2 text-xs"
                          data-log-entry
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
                            <span>
                              Start: <span className="text-gray-900">{formatClock(entry.startTime)}</span>
                            </span>
                            <span>
                              End: <span className="text-gray-900">{formatClock(entry.endTime)}</span>
                            </span>
                            <span>
                              Duration: <span className="text-gray-900">{formatDuration(duration ?? 0)}</span>
                            </span>
                            <span
                              className={`font-medium ${
                                entry.outcome === 'success'
                                  ? 'text-emerald-600'
                                  : entry.outcome === 'failure'
                                  ? 'text-red-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {entry.outcome}
                            </span>
                            {entry.failureReason && (
                              <span className="w-full text-red-500">
                                {entry.failureReason}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {tokenUsage > 0 && (
                      <div className="rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-700" data-token-usage>
                        Token usage: {tokenUsage.toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  });

  // Per-section rows — only during progressive cloning (Req 10.2).
  const sectionNames = Object.keys(sectionStatuses);
  const showSections =
    currentPhase === 'progressive_cloning' && sectionNames.length > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm" data-progress-ui>
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Generation Progress</h3>
          {startedAt && (
            <span className="text-xs text-gray-400">
              Started {new Date(startedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Overall progress bar (Req 10.3) */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{PHASE_LABELS[currentPhase] ?? currentPhase}</span>
            <span data-overall-percent>{Math.round(overallPercent)}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
              initial={false}
              animate={{ width: `${Math.min(Math.max(overallPercent, 0), 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>

          {estimatedRemaining != null && estimatedRemaining > 0 && currentPhase !== 'complete' && (
            <p className="mt-1 text-xs text-gray-400" data-estimated-remaining>
              Est. remaining: {formatDuration(estimatedRemaining)}
            </p>
          )}
        </div>
      </div>

      {/* Phase rows (expandable detail panels — Req 10.7) */}
      <div className="border-t border-gray-100">{phaseRows}</div>

      {/* Section-level progress during progressive cloning (Req 10.2) */}
      {showSections && (
        <div className="border-t border-gray-100 px-4 py-3" data-section-rows>
          <p className="mb-2 text-xs font-medium text-gray-500">Sections</p>
          <ul className="space-y-2">
            {sectionNames.map((name) => (
              <li key={name} className="flex items-center gap-2.5" data-section-row={name}>
                <StatusIcon status={sectionStatuses[name]} />
                <span className="flex-1 truncate text-sm text-gray-700">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error rows (Req 10.6) */}
      {errors.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3" data-error-rows>
          <p className="mb-2 text-xs font-medium text-red-500">Issues</p>
          <ul className="space-y-1.5">
            {errors.map((err, idx) => (
              <li
                key={`${err.sectionName}-${idx}`}
                className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
                data-error-row
              >
                <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                <span>
                  <span className="font-medium">{err.sectionName}</span> — {err.errorType}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
