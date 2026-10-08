"use client"

import { useSearchParams } from "next/navigation"
import { RuntimeKeysClient } from "@/components/runtime-control/keys-client"

export function DevelopersKeysClient() {
  const params = useSearchParams()
  const projectId = params.get("project")

  if (!projectId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium">Select a project to manage its keys</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          API keys are project-scoped — choose a project above to create, monitor, rotate, or delete its keys.
        </p>
      </div>
    )
  }

  return <RuntimeKeysClient projectId={projectId} />
}
