import { RuntimeHealthClient } from "@/components/runtime-control/health-client"

export default async function RuntimeHealthPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeHealthClient projectId={projectId} />
}
