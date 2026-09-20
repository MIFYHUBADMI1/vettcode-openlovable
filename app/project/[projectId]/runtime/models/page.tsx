import { RuntimeModelsClient } from "@/components/runtime-control/models-client"

export default async function RuntimeModelsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeModelsClient projectId={projectId} />
}
