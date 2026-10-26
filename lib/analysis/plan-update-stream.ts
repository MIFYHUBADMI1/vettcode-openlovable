/**
 * Withholds the `<plan-update>` protocol block from a streamed reply.
 *
 * The co-founder writes prose and then a machine-readable plan-update block.
 * Only the prose belongs in the transcript — and because the tag arrives split
 * across stream frames, the tail that could still grow into `<plan-update>`
 * has to be held back until it is proven to be ordinary text.
 */

const OPEN_TAG = "<plan-update>"

export interface PlanUpdateFilter {
  /** Text safe to show right now ("" once the protocol block has started). */
  push(chunk: string): string
  /** Release whatever was held back when the stream ends without a tag. */
  flush(): string
}

/** Longest suffix of `s` that is a prefix of `tag` (excluding a full match). */
function partialTagSuffixLength(s: string, tag: string): number {
  const max = Math.min(s.length, tag.length - 1)
  for (let n = max; n > 0; n--) {
    if (s.endsWith(tag.slice(0, n))) return n
  }
  return 0
}

export function createPlanUpdateFilter(): PlanUpdateFilter {
  let held = ""
  let blocked = false

  return {
    push(chunk: string): string {
      if (blocked) return ""
      const combined = held + chunk
      const tagAt = combined.indexOf(OPEN_TAG)
      if (tagAt !== -1) {
        blocked = true
        held = ""
        return combined.slice(0, tagAt)
      }
      const keep = partialTagSuffixLength(combined, OPEN_TAG)
      held = keep > 0 ? combined.slice(combined.length - keep) : ""
      return combined.slice(0, combined.length - keep)
    },
    flush(): string {
      if (blocked) {
        held = ""
        return ""
      }
      const rest = held
      held = ""
      return rest
    },
  }
}
