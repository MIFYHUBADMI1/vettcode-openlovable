import type { Metadata } from "next"
import { AppHeader } from "@/components/app-header"
import { AuthGate } from "@/components/auth/auth-gate"
import { ProjectsWorkspace } from "./workspace"
import { getCurrentUser } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { store } from "@/lib/store/store"
import { getPlatformFinances } from "@/lib/finances/platform-finances"
import { resolveProjectThumbnail } from "@/lib/media/project-thumbnail"
import type { ProjectSummary } from "@/lib/types/project"

export const metadata: Metadata = {
  title: "Your businesses - Atai",
  description: "Manage your businesses, track performance, and decide what to do next — all in one place.",
}

/**
 * Business portfolio workspace — server component.
 *
 * Fetches projects and platform finances server-side, joins them to create
 * enriched business summaries, then passes to the interactive client workspace.
 * Follows the honesty rule: financial data is shown only where available;
 * missing data is labeled "No financial data yet," never fabricated.
 */
export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=/projects")

  // Fetch projects and platform finances in parallel
  const [projects, platformFinances] = await Promise.all([
    store.listProjects(user.id),
    getPlatformFinances(user.id).catch(() => null), // Graceful degradation
  ])

  // Build a map of project finances for quick lookup
  const financesByProject = new Map(
    (platformFinances?.byProject ?? []).map((pf) => [pf.projectId, pf])
  )

  // Enrich projects with financial summaries where available
  const enrichedProjects: Array<ProjectSummary & {
    financialSummary?: {
      earningsMinor: number | null
      creditsCharged: number
      providerCostUsd: number | null
      currency: string | null
      hasFinancialData: boolean
    }
  }> = projects.map((p) => {
    const finance = financesByProject.get(p.id)
    const summary: ProjectSummary = {
      id: p.id,
      name: p.name,
      mode: p.mode,
      state: p.state,
      sourceUrl: p.sourceUrl,
      updatedAt: p.updatedAt,
      thumbnailUrl: resolveProjectThumbnail(p.understanding?.screenshots),
      visibility: p.visibility,
      // Lets the list recognise a build that lost its watching session.
      totalumProjectId: p.totalumProjectId,
      lastPolledAt: p.lastPolledAt,
    }

    if (finance) {
      return {
        ...summary,
        financialSummary: {
          earningsMinor: finance.earningsMinor,
          creditsCharged: finance.creditsCharged,
          providerCostUsd: finance.providerCostUsd,
          currency: finance.currency,
          hasFinancialData: true,
        },
      }
    }

    return {
      ...summary,
      financialSummary: {
        earningsMinor: null,
        creditsCharged: 0,
        providerCostUsd: null,
        currency: null,
        hasFinancialData: false,
      },
    }
  })

  // Portfolio totals for the overview section
  const portfolioTotals = platformFinances?.totals ?? null

  return (
    <AuthGate next="/projects">
      <main className="min-h-svh bg-background text-foreground">
        <AppHeader />
        <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
          <ProjectsWorkspace
            projects={enrichedProjects}
            portfolioTotals={portfolioTotals}
          />
        </div>
      </main>
    </AuthGate>
  )
}
