// app/api/generate-ai-phase/route.ts
// Phase-aware AI generation endpoint for the Progressive Generation Architecture.
// Validates the incoming PhaseGenerationRequest and streams the AI response as SSE.

import { NextRequest, NextResponse } from 'next/server';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { SystemPromptBuilder } from '@/lib/pipeline/system-prompt-builder';
import { PrettyPrinter } from '@/lib/pipeline/pretty-printer';
import {
  VALID_PHASES as VALID_PHASES_ARR,
  validatePhaseRequest,
} from '@/lib/pipeline/phase-request-validation';
import type { PhaseGenerationRequest } from '@/lib/pipeline/phase-request-validation';
import type { SiteBlueprint } from '@/lib/pipeline/types';

// Force dynamic rendering so streaming works correctly in Next.js App Router
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export type { GenerationPhase } from '@/lib/pipeline/phase-request-validation';

const VALID_PHASES = new Set<string>(VALID_PHASES_ARR);

/** Targeted build-fix payload used by the ValidationPhaseHandler (Req 4.4). */
export type FixRequest = import('@/lib/pipeline/phase-request-validation').FixRequest;

// ---------------------------------------------------------------------------
// AI providers — mirrors the configuration used by generate-ai-code-stream
// ---------------------------------------------------------------------------

const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

const groq = createGroq({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.GROQ_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : undefined,
});

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

// Default to the requested free OpenRouter NVIDIA model for every phase.
const DEFAULT_MODEL = 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free';

/** Per-phase output ceiling — scoped prompts need far fewer tokens (Req 7.7). */
const MAX_TOKENS_BY_PHASE: Record<import('@/lib/pipeline/phase-request-validation').GenerationPhase, number> = {
  analyze: 4096,
  instant_preview: 8192,
  progressive_clone: 6144,
  polish: 6144,
};

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function buildSystemPrompt(body: PhaseGenerationRequest): string {
  if (body.fixRequest) {
    return SystemPromptBuilder.buildValidationFix();
  }

  // For the polish phase the pass type travels in `targetSection`.
  if (body.phase === 'polish') {
    return SystemPromptBuilder.build('polish', undefined, body.targetSection);
  }

  return SystemPromptBuilder.build(body.phase, body.targetSection);
}

function buildUserPrompt(body: PhaseGenerationRequest): string {
  const { phase, targetSection, blueprint, scrapedContent, fixRequest } = body;

  if (fixRequest) {
    return [
      `FILE PATH: ${fixRequest.filePath}`,
      '',
      'BUILD ERROR:',
      fixRequest.errorMessage,
      '',
      'CURRENT FILE CONTENT:',
      fixRequest.fileContent,
    ].join('\n');
  }

  if (phase === 'analyze') {
    return [
      'Analyze the following scraped website content and return the Site Blueprint JSON.',
      '',
      'SCRAPED CONTENT:',
      (scrapedContent ?? '').slice(0, 60_000),
    ].join('\n');
  }

  // Every non-analyze phase carries a validated blueprint.
  const blueprintText = blueprint
    ? PrettyPrinter.format(blueprint)
    : '{}';

  const lines = ['SITE BLUEPRINT:', blueprintText, ''];

  if (phase === 'instant_preview') {
    lines.push(
      'Generate the minimal placeholder layout for every section in the blueprint,',
      'applying the blueprint colors and typography as the base design system.',
    );
  } else if (phase === 'progressive_clone') {
    lines.push(
      `Generate ONLY the "${targetSection}" section with real content and styling`,
      'that matches the blueprint. Do not modify any other section.',
    );
  } else if (phase === 'polish') {
    lines.push(
      `Apply the "${targetSection ?? 'responsive'}" polish pass to the existing files.`,
    );
  }

  // User-provided inputs threaded from the generation pipeline: style,
  // additional instructions, and brand guidelines (brand-extension mode).
  // Inserted before ORIGINAL SITE CONTENT so they always reach the model.
  if (body.brandGuidelines) {
    lines.push(
      'BRAND GUIDELINES:',
      JSON.stringify(body.brandGuidelines, null, 2).slice(0, 8000),
      '',
      'Build a NEW application that fulfils the user request below using these',
      'brand guidelines. Do NOT recreate the original website.',
      '',
    );
  }
  if (body.styleName) {
    lines.push(`DESIGN STYLE: ${body.styleName}`, '');
  }
  if (body.instructions) {
    lines.push('ADDITIONAL USER REQUIREMENTS:', body.instructions, '');
  }

  if (scrapedContent) {
    lines.push('', 'ORIGINAL SITE CONTENT:', scrapedContent.slice(0, 40_000));
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest): Promise<Response> {
  // Parse JSON body
  let body: PhaseGenerationRequest;
  try {
    body = (await request.json()) as PhaseGenerationRequest;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  // --- Validation ---

  const validationError = validatePhaseRequest(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // --- Streaming SSE response ---

  const encoder = new TextEncoder();
  const transformStream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = transformStream.writable.getWriter();

  const sendEvent = async (data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (err) {
      console.error('[generate-ai-phase] Error writing SSE event:', err);
    }
  };

  // Process in background — mirrors the pattern used in generate-ai-code-stream
  (async () => {
    try {
      await sendEvent({
        type: 'status',
        message: 'Processing...',
        phase: body.phase,
        ...(body.targetSection ? { targetSection: body.targetSection } : {}),
      });

      const requestedModel = body.model ?? DEFAULT_MODEL;
      const isOpenRouter = requestedModel.startsWith('openrouter/');
      const modelProvider = isOpenRouter ? openrouter : groq;
      const actualModel = isOpenRouter
        ? requestedModel.replace('openrouter/', '')
        : requestedModel;

      const result = await streamText({
        model: modelProvider(actualModel),
        messages: [
          { role: 'system', content: buildSystemPrompt(body) },
          { role: 'user', content: buildUserPrompt(body) },
        ],
        maxTokens: MAX_TOKENS_BY_PHASE[body.phase],
        temperature: body.phase === 'analyze' ? 0.2 : 0.7,
      } as Parameters<typeof streamText>[0]);

      for await (const textPart of result.textStream) {
        await sendEvent({ type: 'stream', text: textPart, phase: body.phase });
      }

      // Token accounting per phase (Req 6.7).
      let tokenUsage = 0;
      try {
        const usage = await result.usage;
        tokenUsage =
          (usage as { totalTokens?: number } | undefined)?.totalTokens ?? 0;
      } catch {
        tokenUsage = 0;
      }

      await sendEvent({ type: 'complete', phase: body.phase, tokenUsage });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error during generation';
      console.error('[generate-ai-phase] Unhandled error:', err);
      await sendEvent({ type: 'error', message, phase: body.phase });
    } finally {
      try {
        await writer.close();
      } catch {
        // writer may already be closed — safe to ignore
      }
    }
  })();

  return new Response(transformStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
