// app/api/projects/[id]/route.ts
// PATCH  — rename a project.
// DELETE — permanently delete a project record from MongoDB.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteProject, getProject, renameProject } from '@/lib/projects';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'A non-empty name is required' },
        { status: 400 },
      );
    }

    const renamed = await renameProject(id, session.user.id, name.trim());
    if (!renamed) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /projects PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to rename project' },
      { status: 500 },
    );
  }
}


export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Optionally kill the sandbox on the server if it's registered here.
    const project = await getProject(id, session.user.id);
    if (project) {
      try {
        await sandboxManager.terminateSandbox(project.sandboxId);
      } catch {
        // sandbox may already be gone — ignore
      }
    }

    const deleted = await deleteProject(id, session.user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /projects DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 },
    );
  }
}
