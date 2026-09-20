/**
 * Atai SDK — Web scrape capability.
 *
 * Provider-neutral single-page scraping (`web.scrape`/`scrape`). Only public
 * http(s) URLs are accepted; internal/private addresses are rejected by the
 * runtime before any provider contact.
 *
 * @module capabilities/web
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type { AtaiRequestOptions, WebScrapeInput, WebScrapeResult } from "../types.js"

/** Client-side validation (developer experience only; the server is authoritative). */
function validateScrapeInput(input: WebScrapeInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Scrape input must be an object with a `url` string.")
  }
  if (typeof input.url !== "string" || input.url.length === 0 || input.url.length > 2048) {
    throw new AtaiError("atai_invalid_request", "Scraping requires a `url` between 1 and 2,048 characters.")
  }
  let parsed: URL
  try {
    parsed = new URL(input.url)
  } catch {
    throw new AtaiError("atai_invalid_request", "`url` must be an absolute http(s) URL.")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AtaiError("atai_invalid_request", "`url` must use http: or https:.")
  }
}

/** The Atai web capability. Exposed as `atai.web` on the client. */
export class WebCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /** Run one provider-neutral scrape operation (`web.scrape`/`scrape`). */
  async scrape(input: WebScrapeInput, options?: AtaiRequestOptions): Promise<WebScrapeResult> {
    validateScrapeInput(input)

    const body = {
      capability: "web.scrape",
      operation: "scrape",
      input: { url: input.url },
    }

    const { envelope } = await execute<typeof body, WebScrapeResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertScrapeResult(envelope.data.data)
  }
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertScrapeResult(payload: unknown): WebScrapeResult {
  if (typeof payload !== "object" || payload === null || typeof (payload as Record<string, unknown>).url !== "string") {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as WebScrapeResult
}
