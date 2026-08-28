// lib/pipeline/progressive-file-application.ts
// ProgressiveFileApplicationService — writes files to a sandbox, triggering
// hot-reload after each confirmed write (Req 8.1 – 8.6, 3.6 – 3.8).

import type { ParsedFile } from '../file-parser';
import { SandboxProvider } from '../sandbox/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FileApplicationOptions {
  /**
   * When true, each file is written immediately as it is parsed and a hot
   * reload is triggered after every confirmed write (Req 8.1, 8.2).
   * When false, all files are written in bulk first (used during Instant
   * Preview generation where a full layout is applied at once).
   */
  isProgressive: boolean;

  /**
   * Optional section name — used to group file writes for batch logging
   * (Req 8.6).
   */
  sectionName?: string;

  /**
   * Optional callback fired after each file is successfully written to the
   * sandbox (Req 8.2).
   */
  onFileWritten?: (path: string) => void;
}

export interface FileApplicationResult {
  /** Paths of files that were written successfully. */
  writtenFiles: string[];
  /** Paths of files whose write (and background retry) both failed. */
  failedFiles: string[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Handles writing parsed AI-generated files to a SandboxProvider, with
 * support for progressive (per-file hot-reload) and bulk write modes.
 */
export class ProgressiveFileApplicationService {
  // -------------------------------------------------------------------------
  // applyFiles
  // -------------------------------------------------------------------------

  /**
   * Apply a list of parsed files to the given sandbox provider.
   *
   * In **progressive mode** (options.isProgressive = true):
   *   - Each file is written immediately.
   *   - On write failure, a background retry is fired as a fire-and-forget
   *     task (non-blocking — subsequent files continue parsing/writing).
   *   - A hot reload is triggered after every file that is **confirmed**
   *     written (i.e. the initial write succeeded — pending background
   *     retries do NOT count toward the guard, per Req 8.3).
   *
   * In **bulk mode** (options.isProgressive = false):
   *   - All files are written sequentially; no hot reload is triggered here
   *     (the caller is responsible for initiating a server start / reload).
   *
   * Req 8.2: on write failure, retry exactly once in a background task.
   * Req 8.3: hot reload is guarded by parse success AND write success.
   * Req 8.6: sectionName is included in log output for batch grouping.
   */
  async applyFiles(
    files: ParsedFile[],
    provider: SandboxProvider,
    options: FileApplicationOptions,
  ): Promise<FileApplicationResult> {
    const writtenFiles: string[] = [];
    const failedFiles: string[] = [];

    const { isProgressive, sectionName, onFileWritten } = options;

    const tag = sectionName
      ? `[ProgressiveFileApplication:${sectionName}]`
      : '[ProgressiveFileApplication]';

    for (const file of files) {
      // Guard: only apply files that parsed successfully (have a path and
      // content).  Incomplete files (isComplete: false) are still applied —
      // the caller (phase handler) decides whether to include them.
      if (!file.path) {
        console.warn(`${tag} Skipping file with empty path`);
        continue;
      }

      let writeSucceeded = false;

      try {
        await provider.writeFile(file.path, file.content);
        writeSucceeded = true;
        writtenFiles.push(file.path);
        onFileWritten?.(file.path);
        console.log(`${tag} Written: ${file.path}`);
      } catch (firstErr) {
        console.error(
          `${tag} Write failed for ${file.path}, scheduling background retry:`,
          firstErr,
        );

        // Background retry — fire-and-forget; must NOT block the loop
        // (Req 8.2).  Capture the current `file` reference explicitly.
        const retryFile = file;
        void provider
          .writeFile(retryFile.path, retryFile.content)
          .then(() => {
            console.log(
              `${tag} Background retry succeeded: ${retryFile.path}`,
            );
            // Note: we intentionally do NOT add to writtenFiles here because
            // the hot-reload guard (Req 8.3) must only fire for files whose
            // initial (synchronous) write succeeded.  The retried file will
            // be picked up on the next hot-reload cycle triggered by a
            // subsequent successful write.
          })
          .catch((retryErr) => {
            console.error(
              `${tag} Background retry also failed for ${retryFile.path}:`,
              retryErr,
            );
            failedFiles.push(retryFile.path);
          });
      }

      // Trigger hot reload only after a confirmed write (Req 8.3).
      if (isProgressive && writeSucceeded) {
        try {
          await this.triggerHotReload(provider);
        } catch (hrErr) {
          // Hot-reload failure is non-fatal — log and continue writing files.
          console.warn(`${tag} Hot reload failed after writing ${file.path}:`, hrErr);
        }
      }
    }

    return { writtenFiles, failedFiles };
  }

  // -------------------------------------------------------------------------
  // triggerHotReload
  // -------------------------------------------------------------------------

  /**
   * Signal Vite's HMR to reload the preview.
   *
   * Strategy (Req 3.6 – 3.8):
   *   1. Run `vite --force` (or equivalent HMR ping) via the sandbox command.
   *      Wait up to 5 seconds for acknowledgement.
   *   2. If the first attempt times out or fails, retry once.
   *   3. If the retry also fails, fall back to a full `restartViteServer()`.
   */
  async triggerHotReload(provider: SandboxProvider): Promise<void> {
    const HMR_TIMEOUT_MS = 5_000;

    const attemptHmr = (): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('HMR acknowledgement timed out after 5 s'));
        }, HMR_TIMEOUT_MS);

        provider
          .runCommand('vite --force')
          .then((result) => {
            clearTimeout(timeout);
            if (result.exitCode === 0) {
              resolve();
            } else {
              reject(
                new Error(
                  `HMR command exited with code ${result.exitCode}: ${result.stderr}`,
                ),
              );
            }
          })
          .catch((err: unknown) => {
            clearTimeout(timeout);
            reject(err);
          });
      });
    };

    try {
      // First attempt
      await attemptHmr();
      console.log('[ProgressiveFileApplication] Hot reload triggered successfully.');
    } catch (firstErr) {
      console.warn(
        '[ProgressiveFileApplication] First HMR attempt failed, retrying:',
        firstErr,
      );

      try {
        // Single retry (Req 3.7)
        await attemptHmr();
        console.log('[ProgressiveFileApplication] Hot reload retry succeeded.');
      } catch (retryErr) {
        console.warn(
          '[ProgressiveFileApplication] HMR retry failed, falling back to full server restart (Req 3.8):',
          retryErr,
        );
        // Full restart fallback (Req 3.8)
        await provider.restartViteServer();
        console.log(
          '[ProgressiveFileApplication] Vite server restarted successfully.',
        );
      }
    }
  }
}
