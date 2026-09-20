import { RuntimeKeysClient } from "@/components/runtime-control/keys-client"

export default async function RuntimeKeysPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  return <RuntimeKeysClient projectId={projectId} />
}
