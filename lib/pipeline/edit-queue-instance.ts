// lib/pipeline/edit-queue-instance.ts
// Shared singleton EditQueue for inter-route coordination (Req 11.2, 9.6).
//
// Both the chat edit endpoint (`generate-ai-code-stream`) and the generation
// pipeline orchestration route (`generation-pipeline`) reference this single
// instance so that edits queued during initial generation are drained by the
// pipeline once it reaches `complete`.

import { EditQueue } from './edit-queue';

export const globalEditQueue = new EditQueue();
