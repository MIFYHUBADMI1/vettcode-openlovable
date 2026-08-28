// lib/pipeline/sse-collect.ts
// Shared SSE collector for the phase generation endpoint.
//
// `/api/generate-ai-phase` streams events shaped like:
//   { type: 'status'  , message, phase }
//   { type: 'stream'  , text, phase }
//   { type: 'complete', phase, tokenUsage }
//   { type: 'error'   , message, phase }
//
// This helper concatenates all `stream` text into a single buffer and captures
// the reported token usage so each phase handler can report it (Req 6.7).

export interface CollectedPhaseStream {
  /** Concatenated AI output text. */
  text: string;
  /** Total tokens reported by the `complete` event, or 0 when unavailable. */
  tokenUsage: number;
  /** Message from an `error` event, when one was emitted. */
  error?: string;
}

function extractText(event: Record<string, unknown>): string | undefined {
  const direct =
    (event['text'] as string | undefined) ??
    (event['content'] as string | undefined) ??
    (event['chunk'] as string | undefined);
  if (direct) return direct;

  if (event['type'] === 'stream' || event['type'] === 'content') {
    return event['data'] as string | undefined;
  }
  return undefined;
}

/**
 * Consume an SSE response from the phase generation endpoint and return the
 * concatenated text plus token usage. Falls back to reading the whole body as
 * plain text when the response is not streamed.
 */
export async function collectPhaseStream(
  response: Response,
): Promise<CollectedPhaseStream> {
  const reader = response.body?.getReader();
  if (!reader) {
    return { text: await response.text(), tokenUsage: 0 };
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let tokenUsage = 0;
  let error: string | undefined;
  let buffer = '';

  const consumeLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;

    const dataStr = trimmed.slice(5).trim();
    if (!dataStr || dataStr === '[DONE]') return;

    try {
      const event = JSON.parse(dataStr) as Record<string, unknown>;

      if (event['type'] === 'complete') {
        const usage = event['tokenUsage'];
        if (typeof usage === 'number') tokenUsage = usage;
        return;
      }

      if (event['type'] === 'error') {
        error = (event['message'] as string | undefined) ?? 'AI stream error';
        return;
      }

      const text = extractText(event);
      if (text) chunks.push(text);
    } catch {
      // Not JSON — treat the raw data value as text.
      chunks.push(dataStr);
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) consumeLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    for (const line of buffer.split('\n')) consumeLine(line);
  }

  return { text: chunks.join(''), tokenUsage, ...(error ? { error } : {}) };
}
