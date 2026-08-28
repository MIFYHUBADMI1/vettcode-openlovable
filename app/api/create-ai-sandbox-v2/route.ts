import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SandboxFactory } from '@/lib/sandbox/factory';
// SandboxProvider type is used through SandboxFactory
import type { SandboxState } from '@/types/sandbox';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { sessionMutex } from '@/lib/session-mutex';
import { saveProject } from '@/lib/projects';

// Store active sandbox globally
declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
}

export async function POST(req: NextRequest) {
  // Read the request body ONCE before entering the mutex. The body stream
  // can only be consumed once — calling req.json() again later would fail
  // with "ReadableStream is locked".
  let bodySourceUrl: string | undefined;
  try {
    const body = await req.json();
    bodySourceUrl = body?.sourceUrl || undefined;
  } catch {
    // Body may be empty or not JSON — that's fine
  }

  // Use a global mutex so two concurrent requests don't create duplicate sandboxes.
  // The mutex shares the plain result, not a NextResponse. Response bodies are
  // readable streams and cannot be returned to multiple requests safely.
  try {
    const result = await sessionMutex.run('create-sandbox-v2', async () => {
      try {
      console.log('[create-ai-sandbox-v2] Creating sandbox...');
      
      // Clean up all existing sandboxes
      console.log('[create-ai-sandbox-v2] Cleaning up existing sandboxes...');
      await sandboxManager.terminateAll();
      
      // Also clean up legacy global state
      if (global.activeSandboxProvider) {
        try {
          await global.activeSandboxProvider.terminate();
        } catch (e) {
          console.error('Failed to terminate legacy global sandbox:', e);
        }
        global.activeSandboxProvider = null;
      }
      
      // Clear existing files tracking
      if (global.existingFiles) {
        global.existingFiles.clear();
      } else {
        global.existingFiles = new Set<string>();
      }

      // Create new sandbox using factory
      const provider = SandboxFactory.create();
      const sandboxInfo = await provider.createSandbox();
      
      console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
      await provider.setupViteApp();
      
      // Register with sandbox manager
      sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);
      
      // Also store in legacy global state for backward compatibility
      global.activeSandboxProvider = provider;
      global.sandboxData = {
        sandboxId: sandboxInfo.sandboxId,
        url: sandboxInfo.url
      };
      
      // Initialize sandbox state
      global.sandboxState = {
        fileCache: {
          files: {},
          lastSync: Date.now(),
          sandboxId: sandboxInfo.sandboxId
        },
        sandbox: provider, // Store the provider instead of raw sandbox
        sandboxData: {
          sandboxId: sandboxInfo.sandboxId,
          url: sandboxInfo.url
        }
      };
      
      console.log('[create-ai-sandbox-v2] Sandbox ready at:', sandboxInfo.url);

      // Auto-save this sandbox as a project so the user can resume it later
      // from the dashboard. Best-effort — don't fail sandbox creation if
      // the save fails.
      let project = null;
      try {
        // Use the source URL that was read from the request body before
        // entering the mutex (the body stream can only be consumed once).
        const sourceUrl = bodySourceUrl;

        // Derive a human-readable project name from the source URL hostname,
        // falling back to 'Untitled Project' when no source URL is available.
        let name = 'Untitled Project';
        if (sourceUrl) {
          try {
            const hostname = new URL(
              sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`,
            ).hostname;
            // Strip 'www.' prefix for a cleaner name
            name = hostname.replace(/^www\./, '');
          } catch {
            // If URL parsing fails, use the raw string (truncated)
            name = sourceUrl.length > 40 ? sourceUrl.slice(0, 37) + '...' : sourceUrl;
          }
        }

        const session = await getServerSession(authOptions);
        if (session?.user?.id) {
          project = await saveProject({
            userId: session.user.id,
            sandboxId: sandboxInfo.sandboxId,
            name,
            sandboxUrl: sandboxInfo.url,
            sourceUrl,
          });
          console.log('[create-ai-sandbox-v2] Saved project:', project._id, 'name:', name);
        }
      } catch (saveErr) {
        console.warn('[create-ai-sandbox-v2] Failed to save project:', saveErr);
      }

      return {
        success: true,
        sandboxId: sandboxInfo.sandboxId,
        url: sandboxInfo.url,
        provider: sandboxInfo.provider,
        projectId: project?._id?.toString() ?? null,
        message: 'Sandbox created and Vite React app initialized'
      };

    } catch (error) {
      console.error('[create-ai-sandbox-v2] Error:', error);
      
      // Clean up on error
      await sandboxManager.terminateAll();
      if (global.activeSandboxProvider) {
        try {
          await global.activeSandboxProvider.terminate();
        } catch (e) {
          console.error('Failed to terminate sandbox on error:', e);
        }
        global.activeSandboxProvider = null;
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined
      };
    }
    });

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    console.error('[create-ai-sandbox-v2] Mutex error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
      },
      { status: 500 },
    );
  }
}
