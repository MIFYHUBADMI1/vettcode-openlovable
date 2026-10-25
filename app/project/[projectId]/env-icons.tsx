import { KeyRound } from "lucide-react"

/**
 * Pure presentational icons rendered by the `env` Server Component page.
 * This module must NOT carry `"use client"`: a Server Component may only use a
 * client module's *top-level export as the component itself*, so `EnvPageIcons`
 * would arrive as a client-reference proxy whose `.HeaderIcon` member is
 * `undefined` → "Element type is invalid … but got: undefined".
 */
export const EnvPageIcons = {
  NotBuiltIcon() {
    return (
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <KeyRound className="size-7 text-muted-foreground" />
      </div>
    )
  },
  HeaderIcon() {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <KeyRound className="size-5 text-primary" />
      </div>
    )
  },
}
