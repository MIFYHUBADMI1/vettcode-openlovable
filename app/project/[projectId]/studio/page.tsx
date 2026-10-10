import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { StudioView, type StudioItemView } from "@/components/marketing/studio-view"
import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { getCurrentUser } from "@/lib/auth/session"
import { isStudioEnabledForUser } from "@/lib/marketing/feature-flags"
import { getStudioAffordability } from "@/lib/marketing/studio/credits"
import { listContentItems } from "@/lib/marketing/studio/service"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * Marketing Studio route (Phase 4 — W3).
 *
 * Authorization is unchanged from every other project page: requireOwnedProject
 * session-checks the user and 404s on any non-owner (uniform — no existence
 * leak). The feature flag is evaluated server-side only; when disabled the route
 * renders the EXACT previous coming-soon experience. Listing drafts is a free,
 * read-only view — generating is charged and happens only via the API route /
 * CONFIRM tool, never on page load.
 */
export default async function ProjectStudioPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/studio`)
  const user = await getCurrentUser()

  if (!user || !isStudioEnabledForUser(user.id)) {
    return (
      <ProjectComingSoon
        projectId={project.id}
        projectName={project.name}
        kicker="Create & publish"
        title={`Marketing Studio for ${project.name}`}
        description="This is where you will draft marketing copy in your own brand voice — landing pages, emails, and more. The experience is not available yet."
      />
    )
  }

  // Read-only assembly: no credits charged for viewing this page.
  const { cost, available } = await getStudioAffordability(user.id)
  const docs = await listContentItems(project.id)
  const items: StudioItemView[] = docs.map((d) => ({
    id: d.id,
    template: d.template,
    title: d.title,
    body: d.body,
    version: d.version,
    status: d.status,
    origin: d.origin,
    creditsCharged: d.creditsCharged,
    ...(d.model ? { model: d.model } : {}),
    updatedAt: d.updatedAt,
  }))

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <StudioView projectId={project.id} state={{ enabled: true, cost, available, items }} />
      </div>
    </DashboardShell>
  )
}
