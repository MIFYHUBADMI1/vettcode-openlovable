"use client"

import { RuntimeUsageClient } from "./usage-client"

export function RuntimeRequestsClient({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Each row is a metered runtime call. Request bodies, prompts, and responses are not stored.
      </p>
      <RuntimeUsageClient projectId={projectId} />
    </div>
  )
}
