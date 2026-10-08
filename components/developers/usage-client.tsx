"use client"

import { useSearchParams } from "next/navigation"
import { RuntimeUsageClient } from "@/components/runtime-control/usage-client"
import { RuntimeHealthClient } from "@/components/runtime-control/health-client"

export function DevelopersUsageClient() {
  const params = useSearchParams()
  const projectId = params.get("project")

  if (!projectId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium">Select a project to see usage &amp; health</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Request volumes, success rates, latency, credit charges, and runtime install status per project.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <RuntimeHealthClient projectId={projectId} />
      <RuntimeUsageClient projectId={projectId} />
    </div>
  )
}
