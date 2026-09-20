/**
 * Atai SDK — Vectors capability.
 *
 * Provider-neutral vector database operations (`vectors`/`upsert`, `vectors`/`search`, `vectors`/`delete`). The application
 * never learns which vector provider Atai operates behind the runtime.
 *
 * @module capabilities/vectors
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateUpsertInput(input) {
    if (input === null || typeof input !== "object" || !Array.isArray(input.vectors)) {
        throw new AtaiError("atai_invalid_request", "Vector upsert input must have a `vectors` array.");
    }
    if (input.vectors.length === 0) {
        throw new AtaiError("atai_invalid_request", "Vector upsert requires at least one vector.");
    }
    for (const v of input.vectors) {
        if (typeof v.id !== "string" || v.id.length === 0) {
            throw new AtaiError("atai_invalid_request", "Each vector must have a non-empty `id`.");
        }
        if (!Array.isArray(v.values) || v.values.length === 0) {
            throw new AtaiError("atai_invalid_request", "Each vector must have a non-empty `values` array.");
        }
    }
}
function validateSearchInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Vector search input must be an object with a `vector` array.");
    }
    if (!Array.isArray(input.vector) || input.vector.length === 0) {
        throw new AtaiError("atai_invalid_request", "Vector search requires a non-empty `vector` array.");
    }
}
function validateDeleteInput(input) {
    if (input === null || typeof input !== "object" || !Array.isArray(input.ids)) {
        throw new AtaiError("atai_invalid_request", "Vector delete input must have an `ids` array.");
    }
    if (input.ids.length === 0) {
        throw new AtaiError("atai_invalid_request", "Vector delete requires at least one id.");
    }
}
/** The Atai vectors capability. Exposed as `atai.vectors` on the client. */
export class VectorsCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Upsert vectors (`vectors`/`upsert`). */
    async upsert(input, options) {
        validateUpsertInput(input);
        const body = {
            capability: "vectors",
            operation: "upsert",
            input: { vectors: input.vectors },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertUpsertResult(envelope.data.data);
    }
    /** Search vectors (`vectors`/`search`). */
    async search(input, options) {
        validateSearchInput(input);
        const body = {
            capability: "vectors",
            operation: "search",
            input: {
                vector: input.vector,
                ...(input.topK !== undefined ? { topK: input.topK } : {}),
                ...(input.filter !== undefined ? { filter: input.filter } : {}),
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
    /** Delete vectors (`vectors`/`delete`). */
    async delete(input, options) {
        validateDeleteInput(input);
        const body = {
            capability: "vectors",
            operation: "delete",
            input: { ids: input.ids },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertDeleteResult(envelope.data.data);
    }
}
/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertUpsertResult(payload) {
    if (typeof payload !== "object" || payload === null || typeof payload.count !== "number") {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
function assertSearchResult(payload) {
    if (typeof payload !== "object" || payload === null || !Array.isArray(payload.matches)) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
function assertDeleteResult(payload) {
    if (typeof payload !== "object" || payload === null || typeof payload.count !== "number") {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=vectors.js.map