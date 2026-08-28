// lib/pipeline/phases/validation.ts
// Phase 4: Build Validation — runs npm build, extracts errors, and uses AI
// to apply targeted per-file fixes (Req 4.1 – 4.12).

import { SandboxProvider } from '../../sandbox/types';
import {
  internalApiJsonHeaders,
  phaseEndpointUrl,
  type InternalApiOptions,
} from '../phase-endpoint';
import { collectPhaseStream } from '../sse-collect';

export interface ValidationError {
  filePath: string;
  errorMessage: string;
  lineNumber?: number;
}

export interface FailedFile {
  filePath: string;
  finalError: string;
  attemptCount: number;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  retriedFiles: string[];
  permanentlyFailedFiles: FailedFile[];
  /** Tokens consumed by the AI fix loop (Req 6.7). */
  tokenUsage: number;
}

export class ValidationPhaseHandler {
  constructor(private readonly apiOptions: InternalApiOptions = {}) {}

  /**
   * Execute Phase 4: Build Validation.
   *
   * 1. Run `npm run build` (Req 4.1).
   * 2. If exit code is 0 → success (Req 4.2).
   * 3. Extract errors from build output (Req 4.3).
   * 4. For each failing file: AI fix loop, up to 3 attempts (Req 4.10).
   * 5. Re-run build after each fix to verify (Req 4.9).
   * 6. Surface permanently failing files (Req 4.11).
   */
  async execute(sandboxProvider: SandboxProvider, abortSignal?: AbortSignal): Promise<ValidationResult> {
    if (abortSignal?.aborted) {
      return {
        success: false,
        errors: [],
        retriedFiles: [],
        permanentlyFailedFiles: [],
        tokenUsage: 0,
      };
    }

    const result = await sandboxProvider.runCommand('npm run build');

    if (result.exitCode === 0) {
      return {
        success: true,
        errors: [],
        retriedFiles: [],
        permanentlyFailedFiles: [],
        tokenUsage: 0,
      };
    }

    const buildOutput = `${result.stdout}\n${result.stderr}`;
    const errors = this.extractErrorsFromBuildOutput(buildOutput);

    if (errors.length === 0) {
      // Build failed but we couldn't parse specific errors — surface a generic failure.
      return {
        success: false,
        errors: [
          {
            filePath: 'unknown',
            errorMessage: `Build failed (exit code ${result.exitCode})`,
          },
        ],
        retriedFiles: [],
        permanentlyFailedFiles: [],
        tokenUsage: 0,
      };
    }

    const retriedFiles: string[] = [];
    const permanentlyFailedFiles: FailedFile[] = [];
    let tokenUsage = 0;

    // Deduplicate errors by file path so we fix each file once.
    const errorsByFile = this._groupErrorsByFile(errors);

    for (const [filePath, fileErrors] of errorsByFile.entries()) {
      // Bail out early if the client disconnected.
      if (abortSignal?.aborted) break;

      const combinedError = fileErrors
        .map((e) => e.errorMessage)
        .join('\n');

      let fixed = false;
      let attemptCount = 0;

      for (let attempt = 1; attempt <= 3; attempt++) {
        // Also check before each retry attempt.
        if (abortSignal?.aborted) break;
        attemptCount = attempt;

        // Read the current file content.
        let fileContent: string;
        try {
          fileContent = await sandboxProvider.readFile(filePath);
        } catch (readErr) {
          console.error(
            `[Phase: validating] Could not read file ${filePath}:`,
            readErr,
          );
          break;
        }

        // Ask AI for a targeted fix.
        const fix = await this._requestAIFix(
          filePath,
          fileContent,
          combinedError,
        );
        tokenUsage += fix.tokenUsage;
        const fixResponse = fix.text;

        if (!this.validateAIFixResponse(fixResponse)) {
          console.warn(
            `[Phase: validating] Invalid AI fix response for ${filePath} (attempt ${attempt})`,
          );
          continue;
        }

        // Extract the fixed file content from the response.
        const fixedContent = this._extractFileContent(fixResponse, filePath);
        if (!fixedContent) {
          console.warn(
            `[Phase: validating] Could not extract fixed content for ${filePath} (attempt ${attempt})`,
          );
          continue;
        }

        // Write the fixed file.
        try {
          await sandboxProvider.writeFile(filePath, fixedContent);
          retriedFiles.push(filePath);
        } catch (writeErr) {
          console.error(
            `[Phase: validating] Failed to write fix for ${filePath}:`,
            writeErr,
          );
          continue;
        }

        // Re-run the build to verify the fix (Req 4.9).
        const buildCheck = await sandboxProvider.runCommand('npm run build');
        if (buildCheck.exitCode === 0) {
          fixed = true;
          console.log(
            `[Phase: validating] Fix succeeded for ${filePath} (attempt ${attempt})`,
          );
          break;
        }

        console.warn(
          `[Phase: validating] Fix attempt ${attempt} for ${filePath} did not resolve build errors`,
        );
      }

      if (!fixed) {
        permanentlyFailedFiles.push({
          filePath,
          finalError: combinedError,
          attemptCount,
        });
      }
    }

    const success = permanentlyFailedFiles.length === 0;

    return {
      success,
      errors,
      retriedFiles: [...new Set(retriedFiles)],
      permanentlyFailedFiles,
      tokenUsage,
    };
  }

  // ---------------------------------------------------------------------------
  // extractErrorsFromBuildOutput
  // ---------------------------------------------------------------------------

  /**
   * Parse build output for TypeScript / Vite / esbuild error patterns.
   * Only called when the build exits with a non-zero exit code (Req 4.3).
   *
   * Handles two formats:
   *  - TypeScript:  `src/Foo.tsx(10,5): error TS2304: ...`
   *  - esbuild/Vite: `path/to/file.tsx:10:5: error: ...`
   */
  extractErrorsFromBuildOutput(output: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const seen = new Set<string>();

    const lines = output.split('\n');

    // TypeScript compiler format: path(line,col): error TSxxxx: message
    const tsRegex =
      /^([^\s(]+\.(?:tsx?|jsx?))\((\d+),\d+\):\s+error\s+TS\d+:\s+(.+)$/;

    // esbuild / Vite format: path/file.tsx:line:col: error: message
    const esbuildRegex =
      /^([^\s:]+\.(?:tsx?|jsx?|[jt]s)):(\d+):\d+:\s+error:\s+(.+)$/;

    // Generic Vite transform error mentioning a file path
    const viteTransformRegex =
      /Transform failed with \d+ error/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip the Vite summary line itself — the detail lines below it are what we parse.
      if (viteTransformRegex.test(trimmed)) continue;

      let filePath: string | undefined;
      let lineNumber: number | undefined;
      let errorMessage: string | undefined;

      const tsMatch = tsRegex.exec(trimmed);
      if (tsMatch) {
        filePath = tsMatch[1];
        lineNumber = parseInt(tsMatch[2], 10);
        errorMessage = tsMatch[3].trim();
      }

      if (!filePath) {
        const esbuildMatch = esbuildRegex.exec(trimmed);
        if (esbuildMatch) {
          filePath = esbuildMatch[1];
          lineNumber = parseInt(esbuildMatch[2], 10);
          errorMessage = esbuildMatch[3].trim();
        }
      }

      if (filePath && errorMessage) {
        // Deduplicate by filePath + errorMessage to avoid flooding.
        const key = `${filePath}:${errorMessage}`;
        if (!seen.has(key)) {
          seen.add(key);
          errors.push({
            filePath,
            errorMessage,
            ...(lineNumber !== undefined ? { lineNumber } : {}),
          });
        }
      }
    }

    return errors;
  }

  // ---------------------------------------------------------------------------
  // validateAIFixResponse
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the AI fix response contains at least one
   * `<file path="...">` block, indicating it contains modified file content
   * (Req 4.6).
   */
  validateAIFixResponse(response: string): boolean {
    return /<file\s+path="[^"]+">/.test(response);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Group ValidationError[] by file path. */
  private _groupErrorsByFile(
    errors: ValidationError[],
  ): Map<string, ValidationError[]> {
    const map = new Map<string, ValidationError[]>();
    for (const error of errors) {
      const existing = map.get(error.filePath) ?? [];
      existing.push(error);
      map.set(error.filePath, existing);
    }
    return map;
  }

  /**
   * Ask the AI generation endpoint for a targeted fix for a single file.
   * The structured `fixRequest` payload makes the endpoint select the
   * validation-fix prompt so the AI returns only the corrected file (Req 4.4).
   */
  private async _requestAIFix(
    filePath: string,
    fileContent: string,
    errorMessage: string,
  ): Promise<{ text: string; tokenUsage: number }> {
    const response = await fetch(phaseEndpointUrl(this.apiOptions.baseUrl), {
      method: 'POST',
      headers: internalApiJsonHeaders(this.apiOptions),
      body: JSON.stringify({
        // `analyze` is the only phase that does not require a blueprint; the
        // `fixRequest` field overrides prompt selection on the server.
        phase: 'analyze',
        fixRequest: { filePath, fileContent, errorMessage },
      }),
    });

    if (!response.ok) {
      console.warn(
        `[Phase: validating] AI fix request failed: ${response.status} ${response.statusText}`,
      );
      return { text: '', tokenUsage: 0 };
    }

    const collected = await collectPhaseStream(response);
    return { text: collected.text, tokenUsage: collected.tokenUsage };
  }

  /**
   * Extract the content of a specific file path from an AI response that
   * contains `<file path="...">...</file>` blocks.
   *
   * Returns null if the expected file block is not found.
   */
  private _extractFileContent(
    response: string,
    filePath: string,
  ): string | null {
    // Escape the file path for use in a regex.
    const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `<file\\s+path="${escapedPath}">([\\s\\S]*?)<\\/file>`,
    );
    const match = regex.exec(response);
    if (match) return match[1].trim();

    // Fallback: if there's only one file block, use its content regardless of path.
    const singleMatch = /<file\s+path="[^"]+">([^]*?)<\/file>/.exec(response);
    if (singleMatch) return singleMatch[1].trim();

    return null;
  }
}
