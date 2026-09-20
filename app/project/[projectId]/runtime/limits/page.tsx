import { RuntimeLimitsClient } from "@/components/runtime-control/limits-client"

export default async function RuntimeLimitsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeLimitsClient projectId={projectId} />
}
