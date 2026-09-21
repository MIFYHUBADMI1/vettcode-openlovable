import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

export default async function ProjectMarketPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/market`)
  return (
    <ProjectComingSoon
      projectId={project.id}
      projectName={project.name}
      kicker="Market & grow"
      title={`Market for ${project.name}`}
      description="This view will already know this product and who it is for. You will not have to re-explain the business. The experience is not available yet."
    />
  )
}
