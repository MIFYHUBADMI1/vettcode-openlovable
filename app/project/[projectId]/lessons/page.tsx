import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

export default async function ProjectLessonsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/lessons`)
  return (
    <ProjectComingSoon
      projectId={project.id}
      projectName={project.name}
      kicker="Business lessons"
      title={`Lessons for ${project.name}`}
      description="This view will already know this product and what you are building. You will not have to re-explain the business. The experience is not available yet."
    />
  )
}
