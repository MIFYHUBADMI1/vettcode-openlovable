// app/api/generation-pipeline/status/route.ts
// Lightweight resumability check for the generation page (Req 6.4).
//
// The page calls GET /api/generation-pipeline/status?sessionId=... on load to
// detect a persisted PipelineContext with a non-null `lastSuccessfulPhase`. When
// one is found the UI shows the resume/restart prompt and waits for explicit
// user choice before triggering any state-machine transition.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PipelineStore } from '../../../../lib/pipeline/pipeline-store';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json(
      { resumable: false, error: 'Missing sessionId' },
      { status: 400 },
    );
  }

  try {
    const persisted = await PipelineStore.loadLatestForSession(sessionId);
    if (!persisted || !persisted.lastSuccessfulPhase) {
      return NextResponse.json({ resumable: false });
    }

    return NextResponse.json({
      resumable: true,
      lastSuccessfulPhase: persisted.lastSuccessfulPhase,
      sandboxId: persisted.sandboxId ?? null,
      sandboxUrl: persisted.sandboxUrl ?? null,
      executionLog: persisted.executionLog,
      updatedAt: persisted.updatedAt,
    });
  } catch (err) {
    console.warn(
      '[GenerationPipelineStatus] Failed to check resumability:',
      err,
    );
    return NextResponse.json({ resumable: false });
  }
}
