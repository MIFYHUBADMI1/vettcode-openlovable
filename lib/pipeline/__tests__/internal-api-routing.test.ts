import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalysisPhaseHandler } from '../phases/analysis';
import { internalApiJsonHeaders, resolveApiUrl } from '../phase-endpoint';
import type { SiteBlueprint } from '../types/blueprint';

const blueprint: SiteBlueprint = {
  version: '1.0',
  sections: [{ name: 'hero', type: 'hero', order: 0 }],
  colors: [{ hex: '#2563eb', usage: 'primary' }],
  typography: {
    fontFamilies: ['Inter'],
    fontWeights: [400, 700],
    fontSizes: ['1rem', '3rem'],
  },
  images: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('internal API routing', () => {
  it('uses the incoming deployment origin instead of the environment fallback', () => {
    expect(resolveApiUrl('/api/generate-ai-phase', 'https://public.example.com/')).toBe(
      'https://public.example.com/api/generate-ai-phase',
    );
  });

  it('forwards request authentication to phase handlers', async () => {
    const body = [
      `data: ${JSON.stringify({
        type: 'stream',
        text: JSON.stringify(blueprint),
        phase: 'analyze',
      })}`,
      `data: ${JSON.stringify({
        type: 'complete',
        tokenUsage: 42,
        phase: 'analyze',
      })}`,
      '',
    ].join('\n\n');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const apiOptions = {
      baseUrl: 'https://public.example.com',
      headers: { cookie: '_vercel_jwt=test-token' },
    };
    const handler = new AnalysisPhaseHandler(apiOptions);

    const result = await handler.execute({ scrapedContent: '# Test' });

    expect(result.blueprint).toEqual(blueprint);
    expect(result.tokenUsage).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://public.example.com/api/generate-ai-phase',
      expect.objectContaining({
        headers: internalApiJsonHeaders(apiOptions),
      }),
    );
  });
});
