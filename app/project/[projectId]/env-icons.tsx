"use client"

import { KeyRound } from "lucide-react"

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
