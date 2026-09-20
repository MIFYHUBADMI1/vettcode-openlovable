/**
 * Atai SDK — Database capability.
 *
 * Provider-neutral database operations (`db`/`query`, `db`/`create`, `db`/`edit`, `db`/`delete`). The application
 * never learns which database provider Atai operates behind the runtime.
 *
 * @module capabilities/database
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, DbQueryInput, DbQueryResult, DbCreateInput, DbCreateResult, DbEditInput, DbEditResult, DbDeleteInput, DbDeleteResult } from "../types.js";
/** The Atai database capability. Exposed as `atai.db` on the client. */
export declare class DatabaseCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Query records (`db`/`query`). */
    query(input: DbQueryInput, options?: AtaiRequestOptions): Promise<DbQueryResult>;
    /** Create a record (`db`/`create`). */
    create(input: DbCreateInput, options?: AtaiRequestOptions): Promise<DbCreateResult>;
    /** Edit a record (`db`/`edit`). */
    edit(input: DbEditInput, options?: AtaiRequestOptions): Promise<DbEditResult>;
    /** Delete a record (`db`/`delete`). */
    delete(input: DbDeleteInput, options?: AtaiRequestOptions): Promise<DbDeleteResult>;
}
//# sourceMappingURL=database.d.ts.map