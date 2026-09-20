/**
 * Atai SDK — Web scrape capability.
 *
 * Provider-neutral single-page scraping (`web.scrape`/`scrape`). Only public
 * http(s) URLs are accepted; internal/private addresses are rejected by the
 * runtime before any provider contact.
 *
 * @module capabilities/web
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, WebScrapeInput, WebScrapeResult } from "../types.js";
/** The Atai web capability. Exposed as `atai.web` on the client. */
export declare class WebCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Run one provider-neutral scrape operation (`web.scrape`/`scrape`). */
    scrape(input: WebScrapeInput, options?: AtaiRequestOptions): Promise<WebScrapeResult>;
}
//# sourceMappingURL=web.d.ts.map