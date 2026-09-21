import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

export default async function ProjectAdsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/ads`)
  return (
    <ProjectComingSoon
      projectId={project.id}
      projectName={project.name}
      kicker="Ads & marketing"
      title={`Marketing for ${project.name}`}
      description="This view will already know this product and how it should be talked about. You will not have to re-explain the business. The experience is not available yet."
    />
  )
}
