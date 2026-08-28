// app/api/projects/[id]/resume/route.ts
// POST — resume a paused sandbox.
//
// This endpoint:
// 1. Loads the project record from MongoDB to get the sandboxId.
// 2. Uses Sandbox.connect(sandboxId) to resume the paused E2B sandbox.
// 3. Registers the reconnected sandbox with the SandboxManager.
// 4. Returns the sandbox URL so the client can load the preview.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProject, touchProject, updateProjectStatus } from '@/lib/projects';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { SandboxFactory } from '@/lib/sandbox/factory';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProject(id, session.user.id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    // Try to find an already-registered provider (sandbox might still be
    // alive in this server process).
    let provider = sandboxManager.getProvider(project.sandboxId);
    let sandboxUrl = project.sandboxUrl;

    if (provider && provider.isAlive()) {
      // Sandbox is already running in this process — just return it.
      await touchProject(id, session.user.id);
      await updateProjectStatus(id, session.user.id, 'running');
      return NextResponse.json({
        success: true,
        sandboxId: project.sandboxId,
        url: sandboxUrl,
        status: 'running',
        message: 'Sandbox already active',
      });
    }

    // Sandbox not in memory — try to resume via E2B connect().
    provider = SandboxFactory.create();
    const reconnected = await provider.reconnect(project.sandboxId);

    if (reconnected) {
      const info = provider.getSandboxInfo();
      if (info) {
        sandboxUrl = info.url;
      }
      sandboxManager.registerSandbox(project.sandboxId, provider);
      await touchProject(id, session.user.id);
      await updateProjectStatus(id, session.user.id, 'running');

      return NextResponse.json({
        success: true,
        sandboxId: project.sandboxId,
        url: sandboxUrl,
        status: 'running',
        message: 'Sandbox resumed successfully',
      });
    }

    // Resume failed — the sandbox may have been killed permanently.
    await updateProjectStatus(id, session.user.id, 'killed');
    return NextResponse.json(
      {
        error:
          'Failed to resume sandbox. It may have been permanently deleted. ' +
          'You will need to create a new one.',
        status: 'killed',
      },
      { status: 410 },
    );
  } catch (error) {
    console.error('[API /projects resume] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resume project' },
      { status: 500 },
    );
  }
}
