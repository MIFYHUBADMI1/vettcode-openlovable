/**
 * Atai SDK — Web search capability.
 *
 * Provider-neutral web search (`search.web`/`web`). The application never
 * learns which search provider Atai operates behind the runtime.
 *
 * @module capabilities/search
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, SearchWebInput, SearchWebResult } from "../types.js";
/** The Atai search capability. Exposed as `atai.search` on the client. */
export declare class SearchCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Run one provider-neutral web search operation (`search.web`/`web`). */
    web(input: SearchWebInput, options?: AtaiRequestOptions): Promise<SearchWebResult>;
}
//# sourceMappingURL=search.d.ts.map