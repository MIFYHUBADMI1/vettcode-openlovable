import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { crawlWebsite, crawlWebsiteDeep, isFirecrawlConfigured } from "@/lib/integrations/firecrawl/service"
import { launchProject, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import { initializeProjectInfrastructure } from "@/lib/infrastructure/service"
import { getInfrastructurePlan } from "@/lib/infrastructure/plans"
import { chargeScrapeCredits, chargePlanCredits, chargeDeepCrawlCredits, reserveCredits, refundReservation, getTierCost, classifyComplexity, hasSufficientCredits, SCRAPE_COST, PLAN_COST, DEEP_CRAWL_COST, getScrapeCost, getPlanCost, getDeepCrawlCost } from "@/lib/credits/credits"
import { buildInitialBuildPrompt } from "./prompt-builder"
import { analyzeWebsite } from "./understanding"
import { generateSpecificationFromUnderstanding, generateSpecificationFromIdea } from "./specification"
import type { ProjectEvent, BuildRun } from "@/lib/types/project"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * Automatically launch the Totalum build after analysis completes.
 * Called fire-and-forget from both website and scratch pipelines.
 */
async function autoLaunchBuild(projectId: string) {
  console.log("[v0] pipeline.autoBuild: checking readiness", { projectId })
  const project = await store.getProject(projectId)
  if (!project || !project.specification) {
    console.log("[v0] pipeline.autoBuild: aborting, no project or spec", { projectId })
    return
  }
  if (!isTotalumConfigured()) {
    console.log("[v0] pipeline.autoBuild: Totalum not configured, skipping", { projectId })
    await store.appendEvent(projectId, event("build", "⚙️ Build engine needs a tune-up. Click Build when you're ready!", "warn"))
    return
  }

  const tier = project.specification.complexity ?? classifyComplexity(project.specification)
  const pipelineMode = project.pipelineMode ?? "legacy"
  const creditsNeeded = getTierCost(tier, pipelineMode)
  const canAfford = await hasSufficientCredits(project.userId, creditsNeeded)
  if (!canAfford) {
    console.log("[v0] pipeline.autoBuild: insufficient credits", { projectId })
    await store.appendEvent(projectId, event("build", "💰 Need more credits to fuel the build rocket! Top up and click Build when ready.", "warn"))
    return
  }

  try {
    await store.appendEvent(projectId, event("build", "🎪 Setting up the build circus... Juggling code, APIs, and databases!"))
    const prompt = buildInitialBuildPrompt(project.specification, project.understanding, project.preferences)
    const run: BuildRun = {
      id: cryptoId(),
      userId: project.userId,
      mirrorProjectId: projectId,
      kind: "initial",
      prompt,
      status: "reserved",
      startedAt: Date.now(),
      creditsReserved: creditsNeeded,
    }
    await store.createBuildRun(run)

    const claimed = await store.claimBuildSlot(projectId, { state: "building" })
    if (!claimed) {
      console.log("[v0] pipeline.autoBuild: could not claim build slot", { projectId })
      return
    }

    const modeLabel = pipelineMode === "heavy" ? "Heavy Mode" : "Legacy"
    const reserved = await reserveCredits(project.userId, creditsNeeded, run.id, `${tier.charAt(0).toUpperCase() + tier.slice(1)} application build (${modeLabel})`)
    if (!reserved) {
      await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
      await store.updateProject(projectId, { state: project.state })
      console.log("[v0] pipeline.autoBuild: insufficient credits after claim", { projectId })
      return
    }

    await store.appendEvent(projectId, event("build", `💎 Reserved ${creditsNeeded} credits. Time to build something amazing!`))

    // Determine infrastructure cap for the Totalum project
    const defaultPlan = getInfrastructurePlan("testing")
    const infraCap = defaultPlan?.totalumInfrastructureCredits ?? 5

    await store.appendEvent(projectId, event("build", "🏗️ Assembling the construction crew (AI agents, APIs, databases)..."))

    // Create a memorable project name: mirror-{projectName}-{shortId}
    // e.g., mirror-myapp-a1b2c3 or mirror-example-com-x9y8z7
    const sanitizedName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .slice(0, 20) // Limit to 20 chars for the name part
    const shortId = projectId.replace(/-/g, '').slice(0, 6) // 6 char unique suffix
    const totalumProjectName = `mirror-${sanitizedName}-${shortId}` // e.g., mirror-myapp-a1b2c3

    const launch = await launchProject({
      projectId: totalumProjectName,
      prompt,
      maxInfrastructureCreditsPerMonth: infraCap,
    })
    await store.updateBuildRun(run.id, { status: "running", totalumProjectId: launch.projectId })
    await store.updateProject(projectId, {
      state: "building",
      totalumProjectId: launch.projectId,
    })

    // Initialize infrastructure subscription with Testing plan
    await initializeProjectInfrastructure(projectId, launch.projectId).catch((e) => {
      console.error("[v0] pipeline.autoBuild: infrastructure init failed", e)
    })

    await store.appendEvent(projectId, event("build", "🎉 Build is LIVE! Grab some popcorn and watch the progress. This might take a few minutes!"))
    console.log("[v0] pipeline.autoBuild: launched", { projectId, totalumProjectId: launch.projectId })
  } catch (e) {
    console.log("[v0] pipeline.autoBuild: FAILED", { projectId, message: (e as Error).message })
    logger.error("pipeline.autoBuild", "auto-build failed", { projectId, message: (e as Error).message })
    await store.updateProject(projectId, { state: "specification_ready" })
    await store.appendEvent(projectId, event("build", "🛠️ Auto-build tripped over a cable. No worries—click Build to give it another go!", "error"))
  }
}

/**
 * Runs the full analysis pipeline for a website-mode project, updating project
 * state as it progresses so the client can poll and reflect real status
 * (spec sections 3–6 & 30). Designed to be invoked fire-and-forget; all errors
 * are captured into project state rather than thrown to a caller.
 */
export async function runWebsiteAnalysis(projectId: string, pipelineMode?: "legacy" | "heavy") {
  console.log("[v0] pipeline.website: start", { projectId, pipelineMode })
  const project = await store.getProject(projectId)
  if (!project || !project.sourceUrl) {
    console.log("[v0] pipeline.website: aborting, no project or sourceUrl", { projectId, hasProject: Boolean(project) })
    return
  }

  try {
    await store.updateProject(projectId, { state: "analyzing" })
    await store.appendEvent(projectId, event("analyze", `🔍 Putting on detective hat... Time to stalk ${project.sourceUrl} (legally!)`))
    console.log("[v0] pipeline.website: state -> analyzing", { projectId, sourceUrl: project.sourceUrl })

    if (!isFirecrawlConfigured()) {
      console.log("[v0] pipeline.website: FIRECRAWL_API_KEY missing, aborting", { projectId })
      await store.updateProject(projectId, { state: "build_failed", error: "Firecrawl is not configured." })
      await store.appendEvent(
        projectId,
        event("analyze", "🚫 Our web crawler took a day off. Add FIRECRAWL_API_KEY to wake it up!", "error"),
      )
      return
    }

    // Check credits before crawling.
    const scrapeCost = getScrapeCost(pipelineMode)
    const canAfford = await hasSufficientCredits(project.userId, scrapeCost)
    if (!canAfford) {
      console.log("[v0] pipeline.website: insufficient credits, aborting", { projectId, userId: project.userId, required: scrapeCost })
      await store.updateProject(projectId, { state: "build_failed", error: "Not enough credits for website analysis." })
      await store.appendEvent(projectId, event("analyze", "💳 Oops! Your credit card is doing cardio elsewhere. Need more credits to continue!", "error"))
      return
    }

    await store.appendEvent(projectId, event("analyze", `🕷️ Releasing the web spiders... They're crawling through ${project.sourceUrl} looking for treasures!`))
    console.log("[v0] pipeline.website: step 1/3 crawlWebsite starting", { projectId })
    const evidence = await crawlWebsite(project.sourceUrl)
    console.log("[v0] pipeline.website: step 1/3 crawlWebsite done", {
      projectId,
      pages: evidence.pages.length,
      screenshots: evidence.screenshots.length,
    })
    await store.appendEvent(
      projectId,
      event("analyze", `✨ Jackpot! Found ${evidence.pages.length} pages and ${evidence.screenshots.length} screenshots. Our spiders are happy!`),
    )

    // Store screenshots and assets immediately so they appear in the UI
    // even if later analysis steps fail.
    const crawlAssets = [...new Set(evidence.pages.flatMap((p) => p.images))].slice(0, 40)
    await store.updateProject(projectId, {
      understanding: {
        ...(project.understanding as Record<string, unknown> ?? {}),
        sourceUrl: evidence.sourceUrl,
        screenshots: evidence.screenshots,
        assets: crawlAssets,
      } as import("@/lib/types/understanding").ProjectUnderstanding,
    })
    console.log("[v0] pipeline.website: stored crawl screenshots and assets", {
      projectId,
      screenshots: evidence.screenshots.length,
      assets: crawlAssets.length,
    })

    // Charge credits for the scrape.
    try {
      await chargeScrapeCredits(project.userId, projectId, pipelineMode)
      const modeLabel = pipelineMode === "heavy" ? "Heavy mode" : "Legacy"
      await store.appendEvent(projectId, event("analyze", `💰 Ka-ching! Charged ${scrapeCost} credits for the web crawl (${modeLabel}). Worth every penny!`))
    } catch (e) {
      console.log("[v0] pipeline.website: scrape credit charge failed", { projectId, message: (e as Error).message })
      logger.error("pipeline.scrape", "credit charge failed", { projectId, message: (e as Error).message })
    }

    await store.appendEvent(projectId, event("analyze", `🧠 Feeding everything to our AI... It's speed-reading like it's cramming for finals!`))
    console.log("[v0] pipeline.website: step 2/3 analyzeWebsite (generateText) starting", { projectId })
    const understanding = await analyzeWebsite(evidence)
    console.log("[v0] pipeline.website: step 2/3 analyzeWebsite done", { projectId })
    await store.updateProject(projectId, { state: "analysis_complete", understanding })
    await store.appendEvent(projectId, event("understand", "🎓 Aha! The AI just had its 'eureka' moment. We understand your website now!"))

    await store.appendEvent(projectId, event("specify", `📝 Time to write the master plan... Think of this as your app's blueprint, but cooler!`))
    console.log("[v0] pipeline.website: step 3/3 generateSpecificationFromUnderstanding starting", { projectId, pipelineMode })
    const specification = await generateSpecificationFromUnderstanding(understanding, project.userId, projectId, pipelineMode)
    // Classify complexity for customer-facing tier pricing.
    specification.complexity = classifyComplexity(specification)
    const wasSanitized = (specification as Record<string, unknown>)._sanitized === true
    delete (specification as Record<string, unknown>)._sanitized
    console.log("[v0] pipeline.website: step 3/3 generateSpecificationFromUnderstanding done", { projectId, complexity: specification.complexity, sanitized: wasSanitized })
    await store.updateProject(projectId, {
      state: "specification_ready",
      specification,
      name: specification.title || project.name,
      ...(wasSanitized ? { specSanitized: true } : {}),
    })
    if (wasSanitized) {
      await store.appendEvent(projectId, event("specify", "⚙️ Pro tip: We swapped some tech for Totalum SDK. Think of it as upgrading from a bicycle to a Tesla!", "warn"))
    }
    await store.appendEvent(projectId, event("specify", `🎯 Blueprint complete! Your app is classified as ${specification.complexity.toUpperCase()} tier. Let's build this!`))

    // Charge credits for the plan generation.
    try {
      await chargePlanCredits(project.userId, projectId, pipelineMode)
      const modeLabel = pipelineMode === "heavy" ? "Heavy mode" : "Legacy"
      await store.appendEvent(projectId, event("specify", `💸 Plan credits charged (${modeLabel}). Your wallet is lighter, but your app is getting closer!`))
    } catch (e) {
      console.log("[v0] pipeline.website: plan credit charge failed", { projectId, message: (e as Error).message })
      logger.error("pipeline.plan", "credit charge failed", { projectId, message: (e as Error).message })
    }

    await store.appendEvent(projectId, event("build", `🚀 Hold tight! Auto-launching your build... This is where the magic happens!`))
    console.log("[v0] pipeline.website: analysis complete, auto-launching build", { projectId })
    logger.info("pipeline.website", "analysis complete", { projectId })

    // Auto-launch the Totalum build.
    await autoLaunchBuild(projectId)
  } catch (e) {
    console.log("[v0] pipeline.website: FAILED", {
      projectId,
      message: (e as Error).message,
      stack: (e as Error).stack,
    })
    logger.error("pipeline.website", "analysis failed", { projectId, message: (e as Error).message })
    await store.updateProject(projectId, { state: "build_failed", error: "We couldn't finish analyzing this website." })
    await store.appendEvent(projectId, event("analyze", "😢 Oops! Something went wrong. Even robots have bad days. Try again?", "error"))
  }
}

/** Runs specification generation for a scratch-mode project. */
export async function runScratchAnalysis(projectId: string, pipelineMode?: "legacy" | "heavy") {
  console.log("[v0] pipeline.scratch: start", { projectId, pipelineMode })
  const project = await store.getProject(projectId)
  if (!project || !project.idea) {
    console.log("[v0] pipeline.scratch: aborting, no project or idea", { projectId, hasProject: Boolean(project) })
    return
  }
  try {
    await store.updateProject(projectId, { state: "analyzing" })
    await store.appendEvent(projectId, event("specify", "💡 Your idea is brilliant! Let's turn those brain waves into code..."))
    console.log("[v0] pipeline.scratch: state -> analyzing, calling generateSpecificationFromIdea", { projectId, pipelineMode })
    await store.appendEvent(projectId, event("specify", "🤖 AI is brainstorming... Imagine a room full of engineers, but faster!"))
    const specification = await generateSpecificationFromIdea(project.idea, project.userId, projectId, pipelineMode)
    // Classify complexity for customer-facing tier pricing.
    specification.complexity = classifyComplexity(specification)
    console.log("[v0] pipeline.scratch: generateSpecificationFromIdea done", { projectId, complexity: specification.complexity })
    const wasSanitized = (specification as Record<string, unknown>)._sanitized === true
    delete (specification as Record<string, unknown>)._sanitized
    await store.updateProject(projectId, {
      state: "specification_ready",
      specification,
      name: specification.title || project.name,
      ...(wasSanitized ? { specSanitized: true } : {}),
    })
    if (wasSanitized) {
      await store.appendEvent(projectId, event("specify", "🔧 Heads up! We upgraded your tech stack to Totalum SDK. It's like swapping dial-up for fiber!", "warn"))
    }
    await store.appendEvent(projectId, event("specify", `🎨 Ta-da! Your app blueprint is ready. Complexity level: ${specification.complexity.toUpperCase()}. Let's make it real!`))

    // Charge credits for the plan generation.
    try {
      await chargePlanCredits(project.userId, projectId, pipelineMode)
      const modeLabel = pipelineMode === "heavy" ? "Heavy mode" : "Legacy"
      await store.appendEvent(projectId, event("specify", `💳 Credits charged (${modeLabel}). Investing in your dream app!`))
    } catch (e) {
      console.log("[v0] pipeline.scratch: plan credit charge failed", { projectId, message: (e as Error).message })
      logger.error("pipeline.plan", "credit charge failed", { projectId, message: (e as Error).message })
    }

    await store.appendEvent(projectId, event("build", "🎬 Lights, camera, action! Starting your build now..."))
    console.log("[v0] pipeline.scratch: analysis complete, auto-launching build", { projectId })

    // Auto-launch the Totalum build.
    await autoLaunchBuild(projectId)
  } catch (e) {
    console.log("[v0] pipeline.scratch: FAILED", {
      projectId,
      message: (e as Error).message,
      stack: (e as Error).stack,
    })
    logger.error("pipeline.scratch", "failed", { projectId, message: (e as Error).message })
    await store.updateProject(projectId, { state: "build_failed", error: "We couldn't generate a plan from your idea." })
    await store.appendEvent(projectId, event("specify", "💔 The plan hit a snag. Even great ideas need a second shot. Try again!", "error"))
  }
}

/**
 * Deep crawl pipeline: crawls the ENTIRE site, then processes it based on pipeline mode.
 * 
 * Pipeline Modes:
 * - legacy: Uses original AI website analysis (included in 500 credit crawl cost)
 * - heavy: Runs full 7-stage pipeline after crawl (500 + 20 = 520 credits total)
 * 
 * Charges 500 credits (DEEP_CRAWL_COST) upfront for crawling.
 */
export async function runDeepCrawlAnalysis(projectId: string, pipelineMode?: "legacy" | "heavy") {
  console.log("[v0] pipeline.deepCrawl: start", { projectId, pipelineMode })
  const project = await store.getProject(projectId)
  if (!project || !project.sourceUrl) {
    console.log("[v0] pipeline.deepCrawl: aborting, no project or sourceUrl", { projectId })
    return
  }

  const mode = pipelineMode ?? "legacy"
  const deepCrawlCost = getDeepCrawlCost(mode)

  try {
    await store.updateProject(projectId, { state: "analyzing" })
    await store.appendEvent(projectId, event("analyze", `Deep crawling ${project.sourceUrl} — collecting entire site (${mode} mode)`))
    console.log("[v0] pipeline.deepCrawl: state -> analyzing", { projectId, sourceUrl: project.sourceUrl, mode, cost: deepCrawlCost })

    if (!isFirecrawlConfigured()) {
      await store.updateProject(projectId, { state: "build_failed", error: "Firecrawl is not configured." })
      await store.appendEvent(projectId, event("analyze", "Firecrawl is not connected.", "error"))
      return
    }

    // Check credits before crawling (500 for legacy, 1000 for heavy)
    const canAfford = await hasSufficientCredits(project.userId, deepCrawlCost)
    if (!canAfford) {
      await store.updateProject(projectId, { state: "build_failed", error: `Not enough credits for deep crawl (${deepCrawlCost} credits required).` })
      await store.appendEvent(projectId, event("analyze", `Not enough credits for deep crawl (${deepCrawlCost} required).`, "error"))
      return
    }

    // Charge credits upfront for deep crawl (500 for legacy, 1000 for heavy)
    try {
      await chargeDeepCrawlCredits(project.userId, projectId, mode)
      await store.appendEvent(projectId, event("analyze", `Deep crawl credits charged (${deepCrawlCost})`))
    } catch (e) {
      console.log("[v0] pipeline.deepCrawl: credit charge failed", { projectId, message: (e as Error).message })
      logger.error("pipeline.deepCrawl", "credit charge failed", { projectId, message: (e as Error).message })
    }

    // Deep crawl the entire site
    console.log("[v0] pipeline.deepCrawl: crawlWebsiteDeep starting", { projectId })
    const evidence = await crawlWebsiteDeep(project.sourceUrl, 50)
    console.log("[v0] pipeline.deepCrawl: crawlWebsiteDeep done", { projectId, pages: evidence.pages.length })
    await store.appendEvent(projectId, event("analyze", `Deep crawl complete — ${evidence.pages.length} pages collected`))

    // Convert crawled evidence into ProjectUnderstanding
    console.log("[v0] pipeline.deepCrawl: converting evidence to understanding", { projectId, mode })
    const crawlAssets = [...new Set(evidence.pages.flatMap((p) => p.images))].slice(0, 80)
    const understanding: import("@/lib/types/understanding").ProjectUnderstanding = {
      sourceUrl: evidence.sourceUrl,
      screenshots: evidence.screenshots,
      assets: crawlAssets,
      pages: evidence.pages.map((p) => ({
        url: p.url,
        title: p.title,
        importance: "primary" as const,
      })),
      targetUsers: [],
      userRoles: [],
      components: [],
      dataEntities: [],
      userFlows: [],
      designSystem: { colors: [], typography: [], visualLanguage: `Deep crawl — ${evidence.pages.length} pages collected` },
      navigation: evidence.navigation,
      contentStructure: [],
      interactions: [],
      observedFunctionality: [],
      inferredFunctionality: [],
      suggestedFeatures: [],
      backendRequirements: [],
      authenticationRequirements: [],
      rawEvidenceReferences: [],
      confidenceNotes: `Deep crawl: ${evidence.pages.length} pages collected from ${evidence.sourceUrl}`,
    }

    await store.updateProject(projectId, { understanding })

    // Generate specification based on pipeline mode
    let specification: import("@/lib/types/specification").ApplicationSpecification

    if (mode === "heavy") {
      // Use the full 7-stage planning pipeline
      console.log("[v0] pipeline.deepCrawl: using heavy mode (7-stage pipeline)", { projectId })
      await store.appendEvent(projectId, event("analyze", "Starting AI planning pipeline (heavy mode)"))

      // Import and use the planning orchestrator
      const { PlanningOrchestrator } = await import("@/lib/planning/orchestrator")
      const orchestrator = new PlanningOrchestrator()

      try {
        const result = await orchestrator.executeWebsitePipeline(projectId, understanding, project.userId, mode)
        specification = result.specification
        console.log("[v0] pipeline.deepCrawl: heavy mode pipeline complete", { projectId })
      } catch (pipelineError) {
        console.log("[v0] pipeline.deepCrawl: heavy mode pipeline failed", {
          projectId,
          error: pipelineError instanceof Error ? pipelineError.message : String(pipelineError)
        })
        throw pipelineError
      }
    } else {
      // Legacy mode: Use original AI website analysis
      console.log("[v0] pipeline.deepCrawl: using legacy mode (original AI analysis)", { projectId })
      await store.appendEvent(projectId, event("analyze", "Generating specification with AI analysis (legacy mode)"))

      specification = await generateSpecificationFromUnderstanding(understanding, project.userId, projectId, "legacy")
      console.log("[v0] pipeline.deepCrawl: legacy AI analysis complete", { projectId })
    }

    // Classify complexity and store specification
    specification.complexity = classifyComplexity(specification)
    await store.updateProject(projectId, {
      state: "specification_ready",
      specification,
      name: specification.title || project.name,
    })

    const modeLabel = mode === "heavy" ? "heavy mode pipeline" : "legacy AI analysis"
    await store.appendEvent(projectId, event("specify", `Specification ready (${modeLabel}) — ${specification.complexity} tier`))
    console.log("[v0] pipeline.deepCrawl: spec ready, auto-launching build", { projectId, mode })

    // Auto-launch build
    await autoLaunchBuild(projectId)
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e)
    console.log("[v0] pipeline.deepCrawl: FAILED", { projectId, message: errorMessage })
    logger.error("pipeline.deepCrawl", "failed", { projectId, message: errorMessage })

    // Store the detailed error message so users can see what went wrong and how to fix it
    await store.updateProject(projectId, { state: "build_failed", error: errorMessage })
    await store.appendEvent(projectId, event("analyze", errorMessage, "error"))
  }
}

/**
 * Generate a clone specification directly from crawled evidence.
 * No AI interpretation — the builder receives the raw page structure
 * and is instructed to create an exact replica.
 */
function generateCloneSpecification(
  evidence: import("@/lib/integrations/firecrawl/types").WebsiteEvidence,
  projectName: string,
): import("@/lib/types/specification").ApplicationSpecification {
  // Extract all page content as the "design direction"
  const allContent = evidence.pages
    .map((p) => {
      const headings = p.headings.join(", ")
      const contentPreview = (p.markdown ?? "").slice(0, 500)
      return `[${p.title ?? p.url}]\nHeadings: ${headings}\nContent: ${contentPreview}`
    })
    .join("\n\n")

  // Extract navigation structure
  const navStructure = evidence.navigation.slice(0, 30).join("\n")

  // Deduce page count and structure
  const pageCount = evidence.pages.length
  const hasAuth = allContent.toLowerCase().includes("login") || allContent.toLowerCase().includes("sign in") || allContent.toLowerCase().includes("register")
  const hasDashboard = allContent.toLowerCase().includes("dashboard") || allContent.toLowerCase().includes("account")

  // Build data entities from page headings and content
  const dataEntities: import("@/lib/types/specification").SpecDataEntity[] = []
  const seenEntities = new Set<string>()
  for (const page of evidence.pages) {
    for (const heading of page.headings) {
      const normalized = heading.toLowerCase().trim()
      if (normalized.length > 2 && normalized.length < 50 && !seenEntities.has(normalized)) {
        seenEntities.add(normalized)
        // Only add if it looks like a data concept
        if (normalized.includes("list") || normalized.includes("table") || normalized.includes("record") || normalized.includes("item") || normalized.includes("entry")) {
          dataEntities.push({ name: heading, fields: [] })
        }
      }
    }
  }

  // Build core flows from navigation links
  const coreFlows: import("@/lib/types/specification").CoreFlow[] = evidence.navigation
    .filter((url) => {
      try {
        const path = new URL(url).pathname
        return path !== "/" && path.length > 1
      } catch {
        return false
      }
    })
    .slice(0, 15)
    .map((url) => {
      try {
        const path = new URL(url).pathname
        const label = path.split("/").filter(Boolean).pop() ?? path
        return { name: label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, " "), description: `Navigate to ${path}` }
      } catch {
        return { name: "Page", description: url }
      }
    })

  // Enable features based on what was found
  const features: import("@/lib/types/specification").SuggestedFeature[] = [
    { key: "auth", label: "Authentication", description: "User sign up, login, sessions", enabled: hasAuth },
    { key: "database", label: "Database", description: "Persistent data storage", enabled: hasDashboard },
    { key: "dashboard", label: "Dashboard", description: "Primary user dashboard", enabled: hasDashboard },
    { key: "api", label: "API", description: "Backend API endpoints", enabled: true },
    { key: "payments", label: "Payments", description: "Checkout and billing", enabled: false },
    { key: "admin", label: "Admin panel", description: "Administrative management UI", enabled: false },
    { key: "uploads", label: "File uploads", description: "Upload and manage files", enabled: false },
  ]

  return {
    applicationType: "full-stack",
    title: projectName || evidence.title || "Cloned Application",
    description: `Exact replica of ${evidence.sourceUrl} — ${pageCount} pages crawled and reconstructed.`,
    purpose: `Clone and replicate the website at ${evidence.sourceUrl} as a working full-stack application. Preserve the original site's navigation, layout, content, and structure exactly as crawled.`,
    targetUsers: [],
    userRoles: [],
    coreFlows,
    suggestedFeatures: features,
    dataEntities,
    authenticationRequirements: hasAuth ? "Include authentication flows matching the original site." : undefined,
    backendRequirements: ["Replicate the original site's structure and content"],
    integrations: [],
    designDirection: `EXACT REPLICA MODE — Reproduce the crawled website's design, layout, colors, typography, and visual structure as closely as possible. Use the following crawled content as the source of truth:\n\nNAVIGATION STRUCTURE:\n${navStructure}\n\nPAGE CONTENT:\n${allContent.slice(0, 15000)}`,
    responsiveRequirements: "Match the original site's responsive behavior.",
    additionalInstructions: `DEEP CRAWL CLONE MODE: This project was created by deep-crawling ${evidence.sourceUrl}. The builder should create an EXACT REPLICA of the crawled site — do NOT reinterpret or redesign. Use the crawled page content, navigation structure, and visual patterns as-is. The user expects a pixel-accurate reproduction of the original website's experience, adapted into a working React/Next.js application.

Crawled pages (${pageCount}):
${evidence.pages.map((p) => `- ${p.title ?? p.url} (${p.url})`).join("\n")}`,
  }
}
