/**
 * Atai SDK — Vectors capability.
 *
 * Provider-neutral vector database operations (`vectors`/`upsert`, `vectors`/`search`, `vectors`/`delete`). The application
 * never learns which vector provider Atai operates behind the runtime.
 *
 * @module capabilities/vectors
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, VectorUpsertInput, VectorUpsertResult, VectorSearchInput, VectorSearchResult, VectorDeleteInput, VectorDeleteResult } from "../types.js";
/** The Atai vectors capability. Exposed as `atai.vectors` on the client. */
export declare class VectorsCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Upsert vectors (`vectors`/`upsert`). */
    upsert(input: VectorUpsertInput, options?: AtaiRequestOptions): Promise<VectorUpsertResult>;
    /** Search vectors (`vectors`/`search`). */
    search(input: VectorSearchInput, options?: AtaiRequestOptions): Promise<VectorSearchResult>;
    /** Delete vectors (`vectors`/`delete`). */
    delete(input: VectorDeleteInput, options?: AtaiRequestOptions): Promise<VectorDeleteResult>;
}
//# sourceMappingURL=vectors.d.ts.map