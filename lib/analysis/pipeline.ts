import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { crawlWebsite, isFirecrawlConfigured } from "@/lib/integrations/firecrawl/service"
import { analyzeWebsite } from "./understanding"
import { generateSpecificationFromUnderstanding, generateSpecificationFromIdea } from "./specification"
import type { ProjectEvent } from "@/lib/types/project"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * Runs the full analysis pipeline for a website-mode project, updating project
 * state as it progresses so the client can poll and reflect real status
 * (spec sections 3–6 & 30). Designed to be invoked fire-and-forget; all errors
 * are captured into project state rather than thrown to a caller.
 */
export async function runWebsiteAnalysis(projectId: string) {
  console.log("[v0] pipeline.website: start", { projectId })
  const project = await store.getProject(projectId)
  if (!project || !project.sourceUrl) {
    console.log("[v0] pipeline.website: aborting, no project or sourceUrl", { projectId, hasProject: Boolean(project) })
    return
  }

  try {
    await store.updateProject(projectId, { state: "analyzing" })
    await store.appendEvent(projectId, event("analyze", `Collecting evidence from ${project.sourceUrl}`))
    console.log("[v0] pipeline.website: state -> analyzing", { projectId, sourceUrl: project.sourceUrl })

    if (!isFirecrawlConfigured()) {
      console.log("[v0] pipeline.website: FIRECRAWL_API_KEY missing, aborting", { projectId })
      await store.updateProject(projectId, { state: "build_failed", error: "Firecrawl is not configured." })
      await store.appendEvent(
        projectId,
        event("analyze", "Website analyzer (Firecrawl) is not connected. Add FIRECRAWL_API_KEY to enable analysis.", "error"),
      )
      return
    }

    console.log("[v0] pipeline.website: step 1/3 crawlWebsite starting", { projectId })
    const evidence = await crawlWebsite(project.sourceUrl)
    console.log("[v0] pipeline.website: step 1/3 crawlWebsite done", {
      projectId,
      pages: evidence.pages.length,
      screenshots: evidence.screenshots.length,
    })
    await store.appendEvent(
      projectId,
      event("analyze", `Collected ${evidence.pages.length} pages, ${evidence.screenshots.length} screenshots`),
    )

    console.log("[v0] pipeline.website: step 2/3 analyzeWebsite (generateObject) starting", { projectId })
    const understanding = await analyzeWebsite(evidence)
    console.log("[v0] pipeline.website: step 2/3 analyzeWebsite done", { projectId })
    await store.updateProject(projectId, { state: "analysis_complete", understanding })
    await store.appendEvent(projectId, event("understand", "Website understanding generated"))

    console.log("[v0] pipeline.website: step 3/3 generateSpecificationFromUnderstanding starting", { projectId })
    const specification = await generateSpecificationFromUnderstanding(understanding)
    console.log("[v0] pipeline.website: step 3/3 generateSpecificationFromUnderstanding done", { projectId })
    await store.updateProject(projectId, {
      state: "specification_ready",
      specification,
      name: specification.title || project.name,
    })
    await store.appendEvent(projectId, event("specify", "Application plan ready for review"))
    console.log("[v0] pipeline.website: complete", { projectId })
    logger.info("pipeline.website", "analysis complete", { projectId })
  } catch (e) {
    console.log("[v0] pipeline.website: FAILED", {
      projectId,
      message: (e as Error).message,
      stack: (e as Error).stack,
    })
    logger.error("pipeline.website", "analysis failed", { projectId, message: (e as Error).message })
    await store.updateProject(projectId, { state: "build_failed", error: "We couldn't finish analyzing this website." })
    await store.appendEvent(projectId, event("analyze", "Analysis failed. Please try again.", "error"))
  }
}

/** Runs specification generation for a scratch-mode project. */
export async function runScratchAnalysis(projectId: string) {
  console.log("[v0] pipeline.scratch: start", { projectId })
  const project = await store.getProject(projectId)
  if (!project || !project.idea) {
    console.log("[v0] pipeline.scratch: aborting, no project or idea", { projectId, hasProject: Boolean(project) })
    return
  }
  try {
    await store.updateProject(projectId, { state: "analyzing" })
    await store.appendEvent(projectId, event("specify", "Turning your idea into an application plan"))
    console.log("[v0] pipeline.scratch: state -> analyzing, calling generateSpecificationFromIdea", { projectId })
    const specification = await generateSpecificationFromIdea(project.idea)
    console.log("[v0] pipeline.scratch: generateSpecificationFromIdea done", { projectId })
    await store.updateProject(projectId, {
      state: "specification_ready",
      specification,
      name: specification.title || project.name,
    })
    await store.appendEvent(projectId, event("specify", "Application plan ready for review"))
    console.log("[v0] pipeline.scratch: complete", { projectId })
  } catch (e) {
    console.log("[v0] pipeline.scratch: FAILED", {
      projectId,
      message: (e as Error).message,
      stack: (e as Error).stack,
    })
    logger.error("pipeline.scratch", "failed", { projectId, message: (e as Error).message })
    await store.updateProject(projectId, { state: "build_failed", error: "We couldn't generate a plan from your idea." })
    await store.appendEvent(projectId, event("specify", "Planning failed. Please try again.", "error"))
  }
}
