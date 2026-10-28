import type { MirrorProject, ProjectCreditBlock } from "@/lib/types/project"

/**
 * A background pipeline run has no request to refuse: auto-build, website
 * analysis and deep crawl are started by a server trigger, so when the owner
 * cannot afford the next step there is no 402 for the credit gate to catch.
 *
 * The shortfall is recorded on the project instead. The project endpoint flags
 * it with a response header, and the gate turns it into the same top-up
 * overlay the founder would have seen in a synchronous flow.
 *
 * Shared between the API route and the client gate, so this file stays
 * dependency-free (types only) — the writer lives in `lib/credits/credit-block`.
 */

/** How long a recorded block still counts as current. Past this the founder has
 * moved on, and re-offering a top-up for a run they abandoned is noise. */
export const CREDIT_BLOCK_FRESH_MS = 10 * 60 * 1000

export const CREDIT_BLOCK_HEADER = "x-credit-block"

export function sanitizeCreditBlock(value: unknown): ProjectCreditBlock | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const required =
    typeof raw.required === "number" && Number.isFinite(raw.required) ? Math.max(0, Math.round(raw.required)) : null
  const available =
    typeof raw.available === "number" && Number.isFinite(raw.available) ? Math.max(0, Math.round(raw.available)) : null
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : null
  const action = typeof raw.action === "string" && raw.action.trim() ? raw.action.trim().slice(0, 80) : null
  if (required === null || available === null || at === null || action === null) return null
  if (required <= available) return null // not a shortfall at all
  return { required, available, action, at }
}

/** The block while it is still worth showing, otherwise null. */
export function freshCreditBlock(
  project: Pick<MirrorProject, "creditBlock"> | null | undefined,
  now = Date.now(),
): ProjectCreditBlock | null {
  const block = sanitizeCreditBlock(project?.creditBlock)
  if (!block) return null
  if (now - block.at > CREDIT_BLOCK_FRESH_MS) return null
  return block
}

/** Header value for the gate. Percent-encoded so the action label stays
 * ASCII-safe on the wire; the decoder is `parseCreditBlockHeader` in
 * `lib/client/credit-gate`. */
export function encodeCreditBlockHeader(block: ProjectCreditBlock): string {
  return encodeURIComponent(JSON.stringify(block))
}
