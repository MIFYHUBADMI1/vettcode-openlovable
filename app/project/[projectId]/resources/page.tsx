import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"
import { getCurrentUser } from "@/lib/auth/session"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { ResourcesClient } from "@/components/project-resources/resources-client"
import {
  getStageNextSteps,
  deriveMarketSnapshot,
  getMarketingChannels,
  deriveValuationSnapshot,
  getFilteredResources,
  getRelevantLearningPaths,
} from "@/lib/resources/business-intelligence"

export default async function ProjectResourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/resources`)
  const user = await getCurrentUser()

  const spec = project.specification
  const state = project.state

  // All derivations are free — no AI calls on page load
  const nextSteps = getStageNextSteps(state, spec)
  const marketCards = spec ? deriveMarketSnapshot(spec) : []
  const marketingChannels = spec ? getMarketingChannels(spec) : []
  const valuationSnapshot = deriveValuationSnapshot(spec ?? ({
    applicationType: "", businessModel: "", revenueModel: "", targetUsers: [],
  } as any))
  const filteredResources = getFilteredResources(spec, state)
  const learningPaths = getRelevantLearningPaths(state)

  // Read cached AI results from project — completely free
  // @ts-expect-error — dynamic cache fields
  const cachedData = (project.resourcesCache ?? {}) as {
    actionPlan?: { text: string; generatedAt: number }
    marketResearch?: { text: string; generatedAt: number }
    competitors?: { data: any[]; generatedAt: number }
    marketingPlaybook?: { text: string; generatedAt: number }
  }

  // Get credit balance for the AI buttons
  const availableCredits = user ? await getAvailableCredits(user.id) : 0

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <ResourcesClient
        projectId={project.id}
        projectName={project.name}
        state={state}
        spec={spec ?? ({} as any)}
        nextSteps={nextSteps}
        marketCards={marketCards}
        marketingChannels={marketingChannels}
        valuationSnapshot={valuationSnapshot}
        filteredResources={filteredResources}
        learningPaths={learningPaths as any}
        cachedData={cachedData}
        availableCredits={availableCredits}
      />
    </DashboardShell>
  )
}
