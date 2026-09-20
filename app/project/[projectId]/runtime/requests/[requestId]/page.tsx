import Link from "next/link"
import { RuntimeRequestDetailClient } from "@/components/runtime-control/request-detail-client"

export default async function RuntimeRequestDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; requestId: string }>
}) {
  const { projectId, requestId } = await params
  return (
    <div className="flex flex-col gap-4">
      <Link href={`/project/${projectId}/runtime/requests`} className="text-xs text-muted-foreground hover:text-foreground">
        ← All requests
      </Link>
      <h2 className="text-lg font-semibold">Request</h2>
      <RuntimeRequestDetailClient projectId={projectId} requestId={requestId} />
    </div>
  )
}
