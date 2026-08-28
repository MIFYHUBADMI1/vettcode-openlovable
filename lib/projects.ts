// lib/projects.ts
// MongoDB-backed persistence for user projects (saved sandboxes).
//
// A "project" represents a user's saved sandbox — it stores the E2B sandboxId,
// the preview URL, a human-readable name, and lifecycle metadata so the user
// can return to their work at any time.
//
// Paused E2B sandboxes are retained indefinitely, so a project row in
// MongoDB + the corresponding paused sandbox on E2B together provide
// permanent access to the user's generated application.

import { getDatabase } from './mongodb';
import { ObjectId } from 'mongodb';

const COLLECTION = 'projects';

/** A saved project / sandbox record stored in MongoDB. */
export interface ProjectRecord {
  _id?: ObjectId;
  userId: string;
  sandboxId: string;
  name: string;
  sandboxUrl: string;
  sourceUrl?: string; // The website that was cloned, if any
  status: 'running' | 'paused' | 'killed' | 'unknown';
  createdAt: Date;
  lastAccessedAt: Date;
  updatedAt: number;
}

/** Fields a client sends when creating/saving a project. */
export interface ProjectInput {
  userId: string;
  sandboxId: string;
  name: string;
  sandboxUrl: string;
  sourceUrl?: string;
}

/** Upsert a project record. If one already exists for the same userId +
 * sandboxId, update it; otherwise insert a new document. */
export async function saveProject(
  input: ProjectInput,
): Promise<ProjectRecord> {
  const db = await getDatabase();
  const now = new Date();
  const timestamp = now.getTime();

  const record: Partial<ProjectRecord> = {
    userId: input.userId,
    sandboxId: input.sandboxId,
    name: input.name,
    sandboxUrl: input.sandboxUrl,
    sourceUrl: input.sourceUrl ?? undefined,
    status: 'running',
    lastAccessedAt: now,
    updatedAt: timestamp,
  };

  // Use upsert so re-saving the same sandbox updates rather than duplicating.
  const result = await db.collection<ProjectRecord>(COLLECTION).findOneAndUpdate(
    { userId: input.userId, sandboxId: input.sandboxId },
    {
      $set: record,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  );

  // Fallback: if the driver doesn't return the doc, fetch it explicitly.
  if (result) {
    return result as ProjectRecord;
  }
  const fallback = await db.collection<ProjectRecord>(COLLECTION).findOne({
    userId: input.userId,
    sandboxId: input.sandboxId,
  });
  if (!fallback) {
    throw new Error('saveProject: upsert returned no document');
  }
  return fallback;
}

/** List all projects for a user, newest first. */
export async function listProjects(userId: string): Promise<ProjectRecord[]> {
  const db = await getDatabase();
  const docs = await db
    .collection<ProjectRecord>(COLLECTION)
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return docs;
}

/** Get a single project by its _id (string form of ObjectId). */
export async function getProject(
  projectId: string,
  userId: string,
): Promise<ProjectRecord | null> {
  const db = await getDatabase();
  if (!ObjectId.isValid(projectId)) {
    return null;
  }
  return db.collection<ProjectRecord>(COLLECTION).findOne({
    _id: new ObjectId(projectId),
    userId,
  });
}

/** Update the status of a project (e.g. running → paused). */
export async function updateProjectStatus(
  projectId: string,
  userId: string,
  status: ProjectRecord['status'],
): Promise<boolean> {
  const db = await getDatabase();
  if (!ObjectId.isValid(projectId)) {
    return false;
  }
  const result = await db.collection<ProjectRecord>(COLLECTION).updateOne(
    { _id: new ObjectId(projectId), userId },
    {
      $set: {
        status,
        lastAccessedAt: new Date(),
        updatedAt: Date.now(),
      },
    },
  );
  return result.modifiedCount > 0 || result.matchedCount > 0;
}

/** Touch the lastAccessedAt timestamp (called when a user resumes a project). */
export async function touchProject(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDatabase();
  if (!ObjectId.isValid(projectId)) {
    return false;
  }
  const result = await db.collection<ProjectRecord>(COLLECTION).updateOne(
    { _id: new ObjectId(projectId), userId },
    {
      $set: {
        lastAccessedAt: new Date(),
        updatedAt: Date.now(),
      },
    },
  );
  return result.modifiedCount > 0 || result.matchedCount > 0;
}

/** Rename a project. */
export async function renameProject(
  projectId: string,
  userId: string,
  name: string,
): Promise<boolean> {
  const db = await getDatabase();
  if (!ObjectId.isValid(projectId)) {
    return false;
  }
  const result = await db.collection<ProjectRecord>(COLLECTION).updateOne(
    { _id: new ObjectId(projectId), userId },
    {
      $set: {
        name,
        updatedAt: Date.now(),
      },
    },
  );
  return result.modifiedCount > 0 || result.matchedCount > 0;
}

/** Permanently delete a project record from MongoDB. */
export async function deleteProject(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const db = await getDatabase();
  if (!ObjectId.isValid(projectId)) {
    return false;
  }
  const result = await db.collection<ProjectRecord>(COLLECTION).deleteOne({
    _id: new ObjectId(projectId),
    userId,
  });
  return result.deletedCount > 0;
}
