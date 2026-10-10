"use client"

import { useState } from "react"
import {
  Target, TrendingUp, Users, Megaphone, BookOpen, BarChart3
} from "lucide-react"
import type { ApplicationSpecification } from "@/lib/types/specification"
import type { ProjectState } from "@/lib/types/project"
import type {
  NextStep, MarketCard, MarketingChannel, ValuationSnapshot
} from "@/lib/resources/business-intelligence"
import type { ResourceSummary } from "@/lib/resources"
import { NextStepsSection } from "./next-steps-section"
import { MarketIntelSection } from "./market-intel-section"
import { CompetitorsSection } from "./competitors-section"
import { MarketingPlaybookSection } from "./marketing-playbook-section"
import { KnowledgeLibrarySection } from "./knowledge-library-section"

interface CachedData {
  actionPlan?: { text: string; generatedAt: number }
  marketResearch?: { text: string; generatedAt: number }
  competitors?: { data: CompetitorProfile[]; generatedAt: number }
  marketingPlaybook?: { text: string; generatedAt: number }
}

export interface CompetitorProfile {
  name: string
  url?: string
  tagline?: string
  founded?: string
  pricing?: string
  businessModel?: string
  strengths?: string[]
  weaknesses?: string[]
  targetCustomer?: string
  competitiveEdge?: string
  fundingStatus?: string
}

type Section = "next-steps" | "market" | "competitors" | "marketing" | "library"

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "next-steps", label: "What to do next", icon: Target },
  { id: "market", label: "Market", icon: TrendingUp },
  { id: "competitors", label: "Competitors", icon: Users },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "library", label: "Knowledge library", icon: BookOpen },
]

export function ResourcesClient({
  projectId,
  projectName,
  state,
  spec,
  nextSteps,
  marketCards,
  marketingChannels,
  valuationSnapshot,
  filteredResources,
  learningPaths,
  cachedData,
  availableCredits,
}: {
  projectId: string
  projectName: string
  state: ProjectState
  spec: ApplicationSpecification
  nextSteps: NextStep[]
  marketCards: MarketCard[]
  marketingChannels: MarketingChannel[]
  valuationSnapshot: ValuationSnapshot
  filteredResources: ResourceSummary[]
  learningPaths: { id: string; title: string; description: string; resources: any[] }[]
  cachedData: CachedData
  availableCredits: number
}) {
  const [active, setActive] = useState<Section>("next-steps")
  const [credits, setCredits] = useState(availableCredits)

  return (
    <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-6 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Business Intelligence
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {projectName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you need to know and do for this specific business — no re-explaining required.
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
          <BarChart3 className="mr-1.5 inline size-3.5" />
          {credits.toLocaleString()} credits
        </div>
      </div>

      {/* Section nav */}
      <nav className="mb-8 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1" aria-label="Resources sections">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Sections */}
      {active === "next-steps" && (
        <NextStepsSection
          projectId={projectId}
          state={state}
          spec={spec}
          nextSteps={nextSteps}
          cachedActionPlan={cachedData.actionPlan}
          credits={credits}
          onCreditsChanged={setCredits}
        />
      )}
      {active === "market" && (
        <MarketIntelSection
          projectId={projectId}
          marketCards={marketCards}
          valuationSnapshot={valuationSnapshot}
          cachedResearch={cachedData.marketResearch}
          credits={credits}
          onCreditsChanged={setCredits}
        />
      )}
      {active === "competitors" && (
        <CompetitorsSection
          projectId={projectId}
          cachedCompetitors={cachedData.competitors}
          spec={spec}
          credits={credits}
          onCreditsChanged={setCredits}
        />
      )}
      {active === "marketing" && (
        <MarketingPlaybookSection
          projectId={projectId}
          channels={marketingChannels}
          cachedPlaybook={cachedData.marketingPlaybook}
          credits={credits}
          onCreditsChanged={setCredits}
        />
      )}
      {active === "library" && (
        <KnowledgeLibrarySection
          resources={filteredResources}
          learningPaths={learningPaths}
          state={state}
        />
      )}
    </div>
  )
}
