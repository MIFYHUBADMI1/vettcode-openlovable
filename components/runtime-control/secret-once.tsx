"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function SecretOnceBanner({
  secret,
  onDismiss,
}: {
  secret: string
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(secret)
    setCopied(true)
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <p className="font-medium text-amber-700 dark:text-amber-400">
        Copy this key now. It will not be shown again.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Store it in your generated app environment. We only keep a hash — we cannot retrieve the secret later.
      </p>
      <code className="mt-3 block break-all rounded-md bg-background px-3 py-2 font-mono text-xs">
        {secret}
      </code>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy key"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
          I have saved it
        </Button>
      </div>
    </div>
  )
}
