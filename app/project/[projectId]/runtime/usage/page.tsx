import { RuntimeUsageClient } from "@/components/runtime-control/usage-client"

export default async function RuntimeUsagePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeUsageClient projectId={projectId} />
}
