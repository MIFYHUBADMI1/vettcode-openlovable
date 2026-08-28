// lib/pipeline/phase-endpoint.ts
// Resolves API route paths to fetch-able URLs.
//
// The phase handlers run inside a Next.js route handler (Node runtime) where
// `fetch('/api/...')` fails because there is no document base URL. This helper
// returns an absolute URL on the server and leaves the relative path untouched
// in the browser.

export interface InternalApiOptions {
  baseUrl?: string;
  headers?: Readonly<Record<string, string>>;
}

/** Absolute base URL of this deployment, or '' when running in the browser. */
export function apiBaseUrl(): string {
  // Browser — relative paths resolve against the current origin.
  if (typeof window !== 'undefined') return '';

  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? '';
  if (explicit) return explicit.replace(/\/+$/, '');

  // Vercel provides the deployment host without a scheme.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  const port = process.env.PORT ?? '3000';
  return `http://localhost:${port}`;
}

/**
 * Resolve an API path (e.g. `/api/generate-ai-phase`) to a URL usable by
 * `fetch()` from either the server or the browser.
 */
export function resolveApiUrl(path: string, baseUrl?: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const resolvedBaseUrl = baseUrl?.replace(/\/+$/, '') ?? apiBaseUrl();
  return `${resolvedBaseUrl}${normalized}`;
}

/** Convenience constant-style accessor for the phase generation endpoint. */
export function phaseEndpointUrl(baseUrl?: string): string {
  return resolveApiUrl('/api/generate-ai-phase', baseUrl);
}

export function internalApiJsonHeaders(
  options?: InternalApiOptions,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...options?.headers,
  };
}
