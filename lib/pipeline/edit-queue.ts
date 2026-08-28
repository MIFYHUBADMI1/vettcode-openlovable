// lib/pipeline/edit-queue.ts
// EditQueue holds incoming chat-edit requests while the initial 5-phase pipeline
// is running. Edits are drained in insertion order once all phases complete (Req 11.2).
// Conflicting edits can be re-queued at the front via prependToFront() so that
// user intent is preserved after an AI validation fix overwrites the same file (Req 9.6).

import type { QueuedEdit } from "./types/pipeline";

export class EditQueue {
  private queue: QueuedEdit[] = [];

  /**
   * A simple boolean lock that prevents a concurrent drain() from returning
   * stale items while the first drain() is consuming the queue.
   */
  private draining = false;

  /**
   * Appends an edit to the end of the queue (Req 11.2).
   */
  enqueue(edit: QueuedEdit): void {
    this.queue.push(edit);
  }

  /**
   * Returns all queued edits in insertion order and clears the internal queue.
   * Concurrent-call safe: a second drain() while the first is in progress
   * returns an empty array immediately (Req 11.2).
   */
  drain(): QueuedEdit[] {
    if (this.draining) {
      return [];
    }

    this.draining = true;
    try {
      const edits = this.queue.slice();
      this.queue = [];
      return edits;
    } finally {
      this.draining = false;
    }
  }

  /**
   * Returns true when the queue contains no pending edits.
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Returns the number of edits currently in the queue.
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Inserts an edit at position 0 of the queue (Req 9.6).
   * Used to re-queue a conflicting user edit at the front after an AI validation
   * fix has taken precedence, so the user's intent is applied immediately after
   * the fix rather than being lost.
   */
  prependToFront(edit: QueuedEdit): void {
    this.queue.unshift(edit);
  }
}
