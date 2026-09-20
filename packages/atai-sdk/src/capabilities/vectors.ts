/**
 * Atai SDK — Vectors capability.
 *
 * Provider-neutral vector database operations (`vectors`/`upsert`, `vectors`/`search`, `vectors`/`delete`). The application
 * never learns which vector provider Atai operates behind the runtime.
 *
 * @module capabilities/vectors
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type {
  AtaiRequestOptions,
  VectorUpsertInput,
  VectorUpsertResult,
  VectorSearchInput,
  VectorSearchResult,
  VectorDeleteInput,
  VectorDeleteResult,
} from "../types.js"

/** Client-side validation (developer experience only; the server is authoritative). */
function validateUpsertInput(input: VectorUpsertInput): void {
  if (input === null || typeof input !== "object" || !Array.isArray(input.vectors)) {
    throw new AtaiError("atai_invalid_request", "Vector upsert input must have a `vectors` array.")
  }
  if (input.vectors.length === 0) {
    throw new AtaiError("atai_invalid_request", "Vector upsert requires at least one vector.")
  }
  for (const v of input.vectors) {
    if (typeof v.id !== "string" || v.id.length === 0) {
      throw new AtaiError("atai_invalid_request", "Each vector must have a non-empty `id`.")
    }
    if (!Array.isArray(v.values) || v.values.length === 0) {
      throw new AtaiError("atai_invalid_request", "Each vector must have a non-empty `values` array.")
    }
  }
}

function validateSearchInput(input: VectorSearchInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Vector search input must be an object with a `vector` array.")
  }
  if (!Array.isArray(input.vector) || input.vector.length === 0) {
    throw new AtaiError("atai_invalid_request", "Vector search requires a non-empty `vector` array.")
  }
}

function validateDeleteInput(input: VectorDeleteInput): void {
  if (input === null || typeof input !== "object" || !Array.isArray(input.ids)) {
    throw new AtaiError("atai_invalid_request", "Vector delete input must have an `ids` array.")
  }
  if (input.ids.length === 0) {
    throw new AtaiError("atai_invalid_request", "Vector delete requires at least one id.")
  }
}

/** The Atai vectors capability. Exposed as `atai.vectors` on the client. */
export class VectorsCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /** Upsert vectors (`vectors`/`upsert`). */
  async upsert(input: VectorUpsertInput, options?: AtaiRequestOptions): Promise<VectorUpsertResult> {
    validateUpsertInput(input)

    const body = {
      capability: "vectors",
      operation: "upsert",
      input: { vectors: input.vectors },
    }

    const { envelope } = await execute<typeof body, VectorUpsertResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertUpsertResult(envelope.data.data)
  }

  /** Search vectors (`vectors`/`search`). */
  async search(input: VectorSearchInput, options?: AtaiRequestOptions): Promise<VectorSearchResult> {
    validateSearchInput(input)

    const body = {
      capability: "vectors",
      operation: "search",
      input: {
        vector: input.vector,
        ...(input.topK !== undefined ? { topK: input.topK } : {}),
        ...(input.filter !== undefined ? { filter: input.filter } : {}),
      },
    }

    const { envelope } = await execute<typeof body, VectorSearchResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertSearchResult(envelope.data.data)
  }

  /** Delete vectors (`vectors`/`delete`). */
  async delete(input: VectorDeleteInput, options?: AtaiRequestOptions): Promise<VectorDeleteResult> {
    validateDeleteInput(input)

    const body = {
      capability: "vectors",
      operation: "delete",
      input: { ids: input.ids },
    }

    const { envelope } = await execute<typeof body, VectorDeleteResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertDeleteResult(envelope.data.data)
  }
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertUpsertResult(payload: unknown): VectorUpsertResult {
  if (typeof payload !== "object" || payload === null || typeof (payload as Record<string, unknown>).count !== "number") {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as VectorUpsertResult
}

function assertSearchResult(payload: unknown): VectorSearchResult {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as Record<string, unknown>).matches)) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as VectorSearchResult
}

function assertDeleteResult(payload: unknown): VectorDeleteResult {
  if (typeof payload !== "object" || payload === null || typeof (payload as Record<string, unknown>).count !== "number") {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as VectorDeleteResult
}
