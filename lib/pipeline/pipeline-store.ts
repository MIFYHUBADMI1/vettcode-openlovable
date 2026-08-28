// lib/pipeline/pipeline-store.ts
// MongoDB-backed persistence for PipelineContext (Req 6.4).
//
// The context is keyed on `sessionId + sandboxId` so an interrupted generation
// can be resumed from `lastSuccessfulPhase` using the persisted blueprint and
// the existing sandbox files.
//
// When MongoDB is not configured (local development without MONGODB_URI) the
// store transparently falls back to an in-process Map so the resume/restart
// prompt still works within a single server lifetime.

import { getDatabase } from '../mongodb';
import type {
  PhaseExecutionLog,
  PhaseState,
  SectionResult,
} from './types/pipeline';
import type { SiteBlueprint } from './types/blueprint';

const COLLECTION = 'pipelineSessions';

/** The serializable subset of PipelineContext that is persisted (Req 6.4). */
export interface PersistedPipelineContext {
  sessionId: string;
  sandboxId: string;
  blueprint: SiteBlueprint | null;
  executionLog: PhaseExecutionLog[];
  sectionResults: SectionResult[];
  lastSuccessfulPhase: PhaseState | null;
  /** Sandbox preview URL, captured after the Instant Preview phase. */
  sandboxUrl: string | null;
  updatedAt: number;
}

/** The payload accepted by `save()` — `sessionId` comes from the key argument. */
export type PipelineContextSnapshot = Omit<
  PersistedPipelineContext,
  'sessionId' | 'updatedAt'
>;

/** In-process fallback used when MongoDB is unavailable. */
const memoryStore = new Map<string, PersistedPipelineContext>();

function storeKey(sessionId: string, sandboxId: string): string {
  return `${sessionId}::${sandboxId}`;
}

export class PipelineStore {
  /**
   * Persist a pipeline context snapshot. Called on every phase transition so
   * an interruption at any point leaves a resumable record behind (Req 6.4).
   *
   * Never throws — persistence failures must not abort a running pipeline.
   */
  static async save(
    sessionId: string,
    sandboxId: string,
    snapshot: PipelineContextSnapshot,
  ): Promise<void> {
    const record: PersistedPipelineContext = {
      sessionId,
      sandboxId,
      blueprint: snapshot.blueprint ?? null,
      executionLog: snapshot.executionLog ?? [],
      sectionResults: snapshot.sectionResults ?? [],
      lastSuccessfulPhase: snapshot.lastSuccessfulPhase ?? null,
      sandboxUrl: snapshot.sandboxUrl ?? null,
      updatedAt: Date.now(),
    };

    // Always keep the in-process copy up to date so reads succeed even if the
    // database write below fails.
    memoryStore.set(storeKey(sessionId, sandboxId), record);

    try {
      const db = await getDatabase();
      await db
        .collection<PersistedPipelineContext>(COLLECTION)
        .updateOne(
          { sessionId, sandboxId },
          { $set: record },
          { upsert: true },
        );
    } catch (err) {
      console.warn(
        '[PipelineStore] Persist to MongoDB failed; using in-memory fallback:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Load a persisted context for an exact `sessionId + sandboxId` pair.
   * Returns null when no record exists.
   */
  static async load(
    sessionId: string,
    sandboxId: string,
  ): Promise<PersistedPipelineContext | null> {
    try {
      const db = await getDatabase();
      const doc = await db
        .collection<PersistedPipelineContext>(COLLECTION)
        .findOne({ sessionId, sandboxId }, { projection: { _id: 0 } });
      if (doc) return doc as PersistedPipelineContext;
    } catch (err) {
      console.warn(
        '[PipelineStore] Load from MongoDB failed; using in-memory fallback:',
        err instanceof Error ? err.message : err,
      );
    }

    return memoryStore.get(storeKey(sessionId, sandboxId)) ?? null;
  }

  /**
   * Load the most recently updated persisted context for a session, regardless
   * of sandboxId. Used on page load, when the client knows its session but not
   * which sandbox the interrupted run was using (Req 6.4).
   */
  static async loadLatestForSession(
    sessionId: string,
  ): Promise<PersistedPipelineContext | null> {
    try {
      const db = await getDatabase();
      const doc = await db
        .collection<PersistedPipelineContext>(COLLECTION)
        .find({ sessionId }, { projection: { _id: 0 } })
        .sort({ updatedAt: -1 })
        .limit(1)
        .next();
      if (doc) return doc as PersistedPipelineContext;
    } catch (err) {
      console.warn(
        '[PipelineStore] Session lookup failed; using in-memory fallback:',
        err instanceof Error ? err.message : err,
      );
    }

    let latest: PersistedPipelineContext | null = null;
    for (const record of memoryStore.values()) {
      if (record.sessionId !== sessionId) continue;
      if (!latest || record.updatedAt > latest.updatedAt) latest = record;
    }
    return latest;
  }

  /**
   * Remove the persisted context for a session + sandbox pair. Called after a
   * pipeline run completes successfully so no stale resume prompt is shown.
   */
  static async clear(sessionId: string, sandboxId: string): Promise<void> {
    memoryStore.delete(storeKey(sessionId, sandboxId));

    try {
      const db = await getDatabase();
      await db.collection(COLLECTION).deleteOne({ sessionId, sandboxId });
    } catch (err) {
      console.warn(
        '[PipelineStore] Clear from MongoDB failed:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /** Test seam: drops the in-process fallback cache. */
  static _resetMemory(): void {
    memoryStore.clear();
  }
}
