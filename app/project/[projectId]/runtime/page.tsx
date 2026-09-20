import { RuntimeOverviewClient } from "@/components/runtime-control/overview-client"

export default async function RuntimeOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeOverviewClient projectId={projectId} />
}
