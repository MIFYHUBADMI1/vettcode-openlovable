// app/api/projects/route.ts
// GET  — list all projects for the authenticated user.
// POST — save a new project (or upsert if sandboxId already exists).

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveProject, listProjects, type ProjectInput } from '@/lib/projects';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projects = await listProjects(session.user.id);

    // Enrich with live sandbox status if the sandbox is registered in the
    // current server process (best-effort — may be 'unknown' on cold start).
    const enriched = await Promise.all(
      projects.map(async (p) => {
        let liveStatus = p.status;
        try {
          const provider = sandboxManager.getProvider(p.sandboxId);
          if (provider) {
            const status = await provider.getStatus();
            if (status !== 'unknown') {
              liveStatus = status as any;
            }
          }
        } catch {
          // ignore — keep the DB status
        }
        return { ...p, _id: p._id?.toString(), status: liveStatus };
      }),
    );

    return NextResponse.json({ success: true, projects: enriched });
  } catch (error) {
    console.error('[API /projects GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sandboxId, name, sandboxUrl, sourceUrl } = body;

    if (!sandboxId || !sandboxUrl) {
      return NextResponse.json(
        { error: 'sandboxId and sandboxUrl are required' },
        { status: 400 },
      );
    }

    const input: ProjectInput = {
      userId: session.user.id,
      sandboxId,
      name: name || 'Untitled Project',
      sandboxUrl,
      sourceUrl,
    };

    const project = await saveProject(input);

    return NextResponse.json({
      success: true,
      project: { ...project, _id: project._id?.toString() },
    });
  } catch (error) {
    console.error('[API /projects POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save project' },
      { status: 500 },
    );
  }
}
