import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

export default async function ProjectCompetitionPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/competition`)
  return (
    <ProjectComingSoon
      projectId={project.id}
      projectName={project.name}
      kicker="Competition"
      title={`Competitors for ${project.name}`}
      description="This view will already know this product, its market, and the research behind it. You will not have to re-explain the business. The experience is not available yet."
    />
  )
}
