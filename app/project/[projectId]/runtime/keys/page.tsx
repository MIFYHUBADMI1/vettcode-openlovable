import { RuntimeKeysClient } from "@/components/runtime-control/keys-client"
import { getDeveloperPortalUrl } from "@/lib/env"

export default async function RuntimeKeysPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeKeysClient projectId={projectId} developerPortalUrl={getDeveloperPortalUrl()} />
}
