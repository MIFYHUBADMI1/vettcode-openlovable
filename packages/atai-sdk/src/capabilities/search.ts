/**
 * Atai SDK — Web search capability.
 *
 * Provider-neutral web search (`search.web`/`web`). The application never
 * learns which search provider Atai operates behind the runtime.
 *
 * @module capabilities/search
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type { AtaiRequestOptions, SearchWebInput, SearchWebResult } from "../types.js"

/** Client-side validation (developer experience only; the server is authoritative). */
function validateSearchInput(input: SearchWebInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Web search input must be an object with a `query` string.")
  }
  if (typeof input.query !== "string" || input.query.length === 0 || input.query.length > 400) {
    throw new AtaiError("atai_invalid_request", "Web search requires a `query` between 1 and 400 characters.")
  }
  if (input.limit !== undefined && (typeof input.limit !== "number" || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 10)) {
    throw new AtaiError("atai_invalid_request", "`limit` must be an integer between 1 and 10 when provided.")
  }
}

/** The Atai search capability. Exposed as `atai.search` on the client. */
export class SearchCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /** Run one provider-neutral web search operation (`search.web`/`web`). */
  async web(input: SearchWebInput, options?: AtaiRequestOptions): Promise<SearchWebResult> {
    validateSearchInput(input)

    const body = {
      capability: "search.web",
      operation: "web",
      input: {
        query: input.query,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
      },
    }

    const { envelope } = await execute<typeof body, SearchWebResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertSearchResult(envelope.data.data)
  }
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertSearchResult(payload: unknown): SearchWebResult {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as Record<string, unknown>).results)) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  for (const item of (payload as { results: unknown[] }).results) {
    if (typeof item !== "object" || item === null) {
      throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
    }
    const r = item as Record<string, unknown>
    if (typeof r.title !== "string" || typeof r.url !== "string") {
      throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
    }
  }
  return payload as unknown as SearchWebResult
}
