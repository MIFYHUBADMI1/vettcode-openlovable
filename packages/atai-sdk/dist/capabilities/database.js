/**
 * Atai SDK — Database capability.
 *
 * Provider-neutral database operations (`db`/`query`, `db`/`create`, `db`/`edit`, `db`/`delete`). The application
 * never learns which database provider Atai operates behind the runtime.
 *
 * @module capabilities/database
 */
import { AtaiError } from "../errors.js";
import { execute } from "../transport.js";
/** Client-side validation (developer experience only; the server is authoritative). */
function validateQueryInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Database query input must be an object with a `tableName`.");
    }
    if (typeof input.tableName !== "string" || input.tableName.length === 0) {
        throw new AtaiError("atai_invalid_request", "Database query requires a non-empty `tableName`.");
    }
}
function validateCreateInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Database create input must be an object with `tableName` and `data`.");
    }
    if (typeof input.tableName !== "string" || input.tableName.length === 0) {
        throw new AtaiError("atai_invalid_request", "Database create requires a non-empty `tableName`.");
    }
    if (typeof input.data !== "object" || input.data === null || Array.isArray(input.data)) {
        throw new AtaiError("atai_invalid_request", "Database create requires a `data` object.");
    }
}
function validateEditInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Database edit input must be an object with `tableName`, `recordId`, and `data`.");
    }
    if (typeof input.tableName !== "string" || input.tableName.length === 0) {
        throw new AtaiError("atai_invalid_request", "Database edit requires a non-empty `tableName`.");
    }
    if (typeof input.recordId !== "string" || input.recordId.length === 0) {
        throw new AtaiError("atai_invalid_request", "Database edit requires a non-empty `recordId`.");
    }
    if (typeof input.data !== "object" || input.data === null || Array.isArray(input.data)) {
        throw new AtaiError("atai_invalid_request", "Database edit requires a `data` object.");
    }
}
function validateDeleteInput(input) {
    if (input === null || typeof input !== "object") {
        throw new AtaiError("atai_invalid_request", "Database delete input must be an object with `tableName` and `recordId`.");
    }
    if (typeof input.tableName !== "string" || input.tableName.length === 0) {
        throw new AtaiError("atai_invalid_request", "Database delete requires a non-empty `tableName`.");
    }
    if (typeof input.recordId !== "string" || input.recordId.length === 0) {
        throw new AtaiError("atai_invalid_request", "Database delete requires a non-empty `recordId`.");
    }
}
/** The Atai database capability. Exposed as `atai.db` on the client. */
export class DatabaseCapability {
    config;
    constructor(config) {
        this.config = config;
    }
    /** Query records (`db`/`query`). */
    async query(input, options) {
        validateQueryInput(input);
        const body = {
            capability: "db",
            operation: "query",
            input: {
                tableName: input.tableName,
                ...(input.filter !== undefined ? { filter: input.filter } : {}),
                ...(input.limit !== undefined ? { limit: input.limit } : {}),
                ...(input.skip !== undefined ? { skip: input.skip } : {}),
                ...(input.sortBy !== undefined ? { sortBy: input.sortBy } : {}),
                ...(input.sortDirection !== undefined ? { sortDirection: input.sortDirection } : {}),
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertQueryResult(envelope.data.data);
    }
    /** Create a record (`db`/`create`). */
    async create(input, options) {
        validateCreateInput(input);
        const body = {
            capability: "db",
            operation: "create",
            input: {
                tableName: input.tableName,
                data: input.data,
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertCreateResult(envelope.data.data);
    }
    /** Edit a record (`db`/`edit`). */
    async edit(input, options) {
        validateEditInput(input);
        const body = {
            capability: "db",
            operation: "edit",
            input: {
                tableName: input.tableName,
                recordId: input.recordId,
                data: input.data,
            },
        };
        const { envelope } = await execute(this.config, {
            path: "",
            method: "POST",
            body,
            options,
        });
        return assertEditResult(envelope.data.data);
    }
    /** Delete a record (`db`/`delete`). */
    async delete(input, options) {
        validateDeleteInput(input);
        const body = {
            capability: "db",
            operation: "delete",
            input: {
                tableName: input.tableName,
                recordId: input.recordId,
            },
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
function assertQueryResult(payload) {
    if (typeof payload !== "object" || payload === null || !Array.isArray(payload.records)) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
function assertCreateResult(payload) {
    if (typeof payload !== "object" || payload === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    const p = payload;
    if (typeof p.record !== "object" || p.record === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
function assertEditResult(payload) {
    if (typeof payload !== "object" || payload === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    const p = payload;
    if (typeof p.record !== "object" || p.record === null) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
function assertDeleteResult(payload) {
    if (typeof payload !== "object" || payload === null || payload.success !== true) {
        throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.");
    }
    return payload;
}
//# sourceMappingURL=database.js.map