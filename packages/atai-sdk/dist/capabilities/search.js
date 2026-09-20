/**
 * Atai SDK — Web search capability.
 *
 * Provider-neutral web search (`search.web`/`web`). The application never
 * learns which search provider Atai operates behind the runtime.
 *
 * @module capabilities/search
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateSearchInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Web search input must be an object with a `query` string.");
    }
    if (typeof input.query !== "string" || input.query.length === 0 || input.query.length > 400) {
        throw new AtaiError("atai_invalid_request", "Web search requires a `query` between 1 and 400 characters.");
    }
    if (input.limit !== undefined && (typeof input.limit !== "number" || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 10)) {
        throw new AtaiError("atai_invalid_request", "`limit` must be an integer between 1 and 10 when provided.");
    }
}
/** The Atai search capability. Exposed as `atai.search` on the client. */
export class SearchCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Run one provider-neutral web search operation (`search.web`/`web`). */
    async web(input, options) {
        validateSearchInput(input);
        const body = {
            capability: "search.web",
            operation: "web",
            input: {
                query: input.query,
                ...(input.limit !== undefined ? { limit: input.limit } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertSearchResult(envelope.data.data);
    }
}
/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertSearchResult(payload) {
    if (typeof payload !== "object" || payload === null || !Array.isArray(payload.results)) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    for (const item of payload.results) {
        if (typeof item !== "object" || item === null) {
            throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
        }
        const r = item;
        if (typeof r.title !== "string" || typeof r.url !== "string") {
            throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
        }
    }
    return payload;
}
//# sourceMappingURL=search.js.map