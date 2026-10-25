/**
 * Refinement actions shared by the client UI and the server generator.
 * Deliberately dependency-free (no server-only import) so the select can list
 * exactly the actions the API accepts — no drift between the two.
 */

export const REFINEMENT_ACTIONS = [
  "improve",
  "shorten",
  "expand",
  "professional",
  "conversational",
  "persuasive",
  "different_audience",
  "stronger_cta",
  "improve_headline",
  "key_messages",
  "platform_version",
] as const

export type RefinementAction = (typeof REFINEMENT_ACTIONS)[number]

export const REFINEMENT_LABELS: Record<RefinementAction, string> = {
  improve: "Improve this content",
  shorten: "Shorten",
  expand: "Expand",
  professional: "More professional",
  conversational: "More conversational",
  persuasive: "More persuasive",
  different_audience: "Rewrite for a different audience",
  stronger_cta: "Strengthen the call to action",
  improve_headline: "Improve the headline",
  key_messages: "Extract key messages",
  platform_version: "Adapt to a channel",
}

/** Actions that need an extra input before they can run. */
export const REFINEMENT_NEEDS: Partial<Record<RefinementAction, "audience" | "channel">> = {
  different_audience: "audience",
  platform_version: "channel",
}

export function isRefinementAction(value: string): value is RefinementAction {
  return (REFINEMENT_ACTIONS as readonly string[]).includes(value)
}
