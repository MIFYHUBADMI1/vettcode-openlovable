import { RuntimeRequestsClient } from "@/components/runtime-control/requests-client"

export default async function RuntimeRequestsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeRequestsClient projectId={projectId} />
}
