// lib/pipeline/__tests__/helpers/mock-sandbox.ts
// In-memory SandboxProvider used by property/integration tests.
// Implements the abstract SandboxProvider with a configurable build queue so
// tests can simulate failing builds, HMR commands, and file writes.

import { SandboxProvider } from '../../../sandbox/types';
import type { CommandResult, SandboxInfo } from '../../../sandbox/types';

export class MockSandboxProvider extends SandboxProvider {
  /** Files written to the mock sandbox. */
  files: Record<string, string> = {};
  /** Every command executed via runCommand. */
  commands: string[] = [];
  /** Exit codes to return for `npm run build` in FIFO order. */
  buildExitCodes: number[] = [];
  /** Build output to return alongside `npm run build`. */
  buildOutput = '';
  /** Number of times restartViteServer was invoked. */
  restartCalls = 0;

  constructor() {
    super({});
  }

  async createSandbox(): Promise<SandboxInfo> {
    return {
      sandboxId: 'mock-sandbox',
      url: 'http://localhost:3000',
      provider: 'e2b',
      createdAt: new Date(),
    };
  }

  async runCommand(command: string): Promise<CommandResult> {
    this.commands.push(command);

    if (command.includes('npm run build')) {
      const exitCode = this.buildExitCodes.length > 0
        ? this.buildExitCodes.shift()!
        : 1;
      return {
        stdout: this.buildOutput,
        stderr: '',
        exitCode,
        success: exitCode === 0,
      };
    }

    // Any other command (e.g. `vite --force` for HMR) succeeds immediately.
    return { stdout: '', stderr: '', exitCode: 0, success: true };
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files[path] = content;
  }

  async readFile(path: string): Promise<string> {
    return this.files[path] ?? '';
  }

  async listFiles(_directory?: string): Promise<string[]> {
    return Object.keys(this.files);
  }

  async installPackages(_packages: string[]): Promise<CommandResult> {
    return { stdout: '', stderr: '', exitCode: 0, success: true };
  }

  getSandboxUrl(): string | null {
    return 'http://localhost:3000';
  }

  getSandboxInfo(): SandboxInfo | null {
    return null;
  }

  async terminate(): Promise<void> {
    // no-op
  }

  isAlive(): boolean {
    return true;
  }

  async restartViteServer(): Promise<void> {
    this.restartCalls++;
  }
}

// ---------------------------------------------------------------------------
// SSE fetch stubbing for phase handlers that call /api/generate-ai-phase
// ---------------------------------------------------------------------------

const ENCODER = new TextEncoder();

/**
 * Return an SSE Response whose body streams a single `stream` event with the
 * given text followed by a `complete` event (with tokenUsage).
 */
export function sseSuccessResponse(text: string, tokenUsage = 5): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        ENCODER.encode(
          `data: ${JSON.stringify({ type: 'stream', text })}\n\n`,
        ),
      );
      controller.enqueue(
        ENCODER.encode(
          `data: ${JSON.stringify({ type: 'complete', tokenUsage })}\n\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

/** Return an SSE Response that streams an `error` event immediately. */
export function sseErrorResponse(message = 'mock AI failure'): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        ENCODER.encode(
          `data: ${JSON.stringify({ type: 'error', message })}\n\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

type FetchLike = typeof globalThis.fetch;

/**
 * Replace global fetch with a stub returning `responder` for every call.
 * Returns a restore function. Safe to call when fetch was already stubbed.
 */
export function stubFetch(
  responder: () => Response,
): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => responder()) as FetchLike;
  return () => {
    globalThis.fetch = original;
  };
}

/**
 * Restore the real global fetch. Used in beforeEach so a leaked stub from a
 * failing property never bleeds into another test.
 */
export function resetFetch(): void {
  // Only reset when fetch is our stub (detected by a marker property).
  const marker = (globalThis.fetch as unknown as { __stubbed?: boolean })
    ?.__stubbed;
  if (marker) {
    globalThis.fetch = (globalThis as unknown as { __originalFetch?: FetchLike })
      .__originalFetch ?? (globalThis.fetch as FetchLike);
  }
}

/**
 * Install a global fetch stub that also records itself so `resetFetch` can
 * undo it. Preferred over `stubFetch` inside property tests.
 */
export function installStubbedFetch(responder: () => Response): () => void {
  const original = globalThis.fetch;
  (globalThis as unknown as { __originalFetch?: FetchLike }).__originalFetch =
    original;
  const stub = (async () => responder()) as FetchLike;
  (stub as unknown as { __stubbed?: boolean }).__stubbed = true;
  globalThis.fetch = stub;
  return () => {
    globalThis.fetch = original;
    delete (globalThis as unknown as { __originalFetch?: FetchLike })
      .__originalFetch;
  };
}

/** A valid JSX file block that parseAIResponse recognizes. */
export const MOCK_AI_FILE = `<file path="src/App.jsx">export default function App(){ return <div>Hi</div>; }</file>`;
