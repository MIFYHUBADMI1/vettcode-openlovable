import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { usersCol, projectGitHubCol } from "@/lib/db/collections"
import { getReadme, getRepoTree, GitHubApiError } from "@/lib/integrations/github/client"
import { buildFileTree } from "@/lib/integrations/github/tree-builder"
import { autoLaunchBuild, markPipelineFailure } from "@/lib/analysis/pipeline"
import { generateSpecificationFromIdea } from "@/lib/analysis/specification"
import type { ProjectEvent, MirrorProject } from "@/lib/types/project"
import type { ProjectUnderstanding } from "@/lib/types/understanding"
import type { ProjectGitHubDoc } from "@/lib/types/db"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * Runs the GitHub-repo analysis pipeline for a project with mode "github".
 * Supports two sub-modes:
 * - Clone: Build from scratch using README + file tree
 * - Extend: Continue existing app with codebase zip + user request
 */
export async function runGitHubAnalysis(projectId: string): Promise<void> {
  logger.info("pipeline.github", "starting", { projectId })

  const project = await store.getProject(projectId)
  if (!project) {
    logger.error("pipeline.github", "project not found", { projectId })
    return
  }

  let phase: "understand" | "plan" = "understand"
  try {
    await store.updateProject(projectId, { state: "analyzing" })
    await store.appendEvent(projectId, event("analyze", "🔍 Reading your GitHub repository..."))

    // Get GitHub connection doc
    const ghCol = await projectGitHubCol()
    const ghDoc = await ghCol.findOne({ projectId, mode: "build-from" })
    if (!ghDoc) {
      await markPipelineFailure(
        projectId,
        "understand",
        "❌ No GitHub repository connected. Please connect one first.",
        "No GitHub repo connected for this project.",
      )
      return
    }

    // Get user's GitHub token (optional - works without it for public repos)
    const userDoc = await (await usersCol()).findOne({ id: project.userId })
    const token = userDoc?.githubAccessToken || null

    const repoOwner = ghDoc.repoOwner!
    const repoName = ghDoc.repoName!
    const branch = ghDoc.branch!
    const repoLabel = `${repoOwner}/${repoName}`
    const subMode = ghDoc.githubSubMode || "clone"

    if (token) {
      await store.appendEvent(projectId, event("analyze", `📂 Fetching repository from ${repoLabel} (authenticated)...`))
    } else {
      await store.appendEvent(projectId, event("analyze", `📂 Fetching public repository ${repoLabel}...`))
    }

    // Fetch README
    let readme: string | null = null
    try {
      readme = await getReadme(token, repoOwner, repoName)
      logger.info("pipeline.github", "readme fetched", { projectId, hasReadme: Boolean(readme) })
    } catch (e) {
      if (e instanceof GitHubApiError && (e.status === 401 || e.status === 403 || e.status === 404)) {
        // Private repo or auth issue
        const isAuthError = e.status === 401 || e.status === 403
        if (isAuthError && !token) {
          await markPipelineFailure(
            projectId,
            "understand",
            "❌ This repository is private. Please connect your GitHub account in Settings → Profile to access private repositories.",
            "This appears to be a private repository. Please connect your GitHub account to access it.",
          )
          return
        } else if (isAuthError && token) {
          await markPipelineFailure(
            projectId,
            "understand",
            "❌ Access denied. Please check that your GitHub account has access to this repository.",
            "Access denied. You may not have permission to access this repository.",
          )
          return
        }
        // 404 might be missing README - handle below based on mode
      } else {
        throw e
      }
    }

    // Clone mode requires README
    if (subMode === "clone" && !readme) {
      await markPipelineFailure(
        projectId,
        "understand",
        "❌ This repository doesn't have a README. Clone mode requires a README at the root of the repository to understand what to build.",
        "Clone mode requires a README file.",
      )
      return
    }

    // Fetch file tree
    let tree
    try {
      tree = await getRepoTree(token, repoOwner, repoName, branch)
    } catch (e) {
      if (e instanceof GitHubApiError) {
        if (e.status === 409) {
          // Empty repo
          await markPipelineFailure(
            projectId,
            "understand",
            "❌ The repository appears to be empty.",
            "The GitHub repository is empty.",
          )
          return
        } else if ((e.status === 401 || e.status === 403) && !token) {
          await markPipelineFailure(
            projectId,
            "understand",
            "❌ This repository is private. Please connect your GitHub account in Settings → Profile to access private repositories.",
            "This appears to be a private repository. Please connect your GitHub account to access it.",
          )
          return
        } else if ((e.status === 401 || e.status === 403) && token) {
          await markPipelineFailure(
            projectId,
            "understand",
            "❌ Access denied. Please check that your GitHub account has access to this repository.",
            "Access denied. You may not have permission to access this repository.",
          )
          return
        }
      }
      throw e
    }

    // Build file tree string
    const allPaths = tree.filter(f => f.type === "blob").map(f => f.path)
    const fileTreeString = buildFileTree(allPaths)

    await store.appendEvent(projectId, event("analyze", `📄 Found ${allPaths.length} files. Building project structure...`))

    // Store README and file tree on project
    await store.updateProject(projectId, {
      githubReadme: readme || undefined,
      githubFileTree: fileTreeString,
    })

    // Branch based on sub-mode
    phase = "plan"
    if (subMode === "extend") {
      await handleExtendMode(projectId, project, ghDoc, token, repoOwner, repoName, branch, repoLabel, readme, fileTreeString)
    } else {
      await handleCloneMode(projectId, project, ghDoc, repoLabel, readme!, fileTreeString)
    }

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error("pipeline.github", "failed", { projectId, phase, error: message })
    await markPipelineFailure(
      projectId,
      phase,
      `❌ Failed to read repository: ${message}`,
      phase === "plan" ? "We couldn't finish the plan for this repository." : "Failed to analyze GitHub repository.",
    )
  }
}

/**
 * Clone mode: Build from scratch using README + file tree.
 * Prompt tells AI to implement what the README describes.
 */
async function handleCloneMode(
  projectId: string,
  project: MirrorProject,
  ghDoc: ProjectGitHubDoc,
  repoLabel: string,
  readme: string,
  fileTree: string
) {
  await store.appendEvent(projectId, event("analyze", "🧬 Clone mode: Building from scratch based on README..."))

  // Build understanding object
  const understanding: ProjectUnderstanding = {
    sourceUrl: `https://github.com/${ghDoc.repoOwner}/${ghDoc.repoName}`,
    title: `${ghDoc.repoOwner}/${ghDoc.repoName}`,
    description: readme.slice(0, 500),
    purpose: `Application cloned from GitHub repository ${repoLabel}`,
    targetUsers: [],
    userRoles: [],
    pages: [],
    navigation: [],
    components: [],
    designSystem: { colors: [], typography: [] },
    contentStructure: [],
    assets: [],
    interactions: [],
    userFlows: [],
    observedFunctionality: [],
    inferredFunctionality: [],
    suggestedFeatures: [],
    dataEntities: [],
    backendRequirements: [],
    authenticationRequirements: [],
    screenshots: [],
    rawEvidenceReferences: [repoLabel],
  }

  await store.updateProject(projectId, {
    understanding,
    state: "analysis_complete",
  })

  await store.appendEvent(projectId, event("analyze", "✅ Repository analyzed! Generating specification..."))

  // Build prompt for clone mode
  const ideaText = `Build an application that does exactly this. Use the built-in database and authentication where needed. Do not ask for clarification — implement your best interpretation.

README:
${readme}

Application structure:
${fileTree}
`

  const specification = await generateSpecificationFromIdea(ideaText, project.userId, projectId)

  await store.updateProject(projectId, {
    state: "plan_ready",
    specification,
    name: specification.title || project.name,
    error: undefined,
    pipelineRecovery: undefined,
  })

  await store.appendEvent(projectId, event("specify", "📋 Plan ready! Review your app plan and refine it before starting the build."))
  await store.appendEvent(projectId, event("plan", "✨ App plan ready! Taking you to the Collaborate page to review and refine before building."))

  logger.info("pipeline.github", "clone mode complete — plan_ready", { projectId })
}

/**
 * Extend mode: Continue existing app with codebase zip + user request.
 * Downloads the repo as a zip, tells AI to extract and continue with user's changes.
 */
async function handleExtendMode(
  projectId: string,
  project: MirrorProject,
  ghDoc: ProjectGitHubDoc,
  token: string | null,
  repoOwner: string,
  repoName: string,
  branch: string,
  repoLabel: string,
  readme: string | null,
  fileTree: string
) {
  await store.appendEvent(projectId, event("analyze", "🔄 Extend mode: Preparing to continue existing codebase..."))

  // GitHub zipball URL (no auth needed for public repos in the download itself)
  const zipUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/zipball/${branch}`

  // Store zip URL on project
  await store.updateProject(projectId, {
    githubZipUrl: zipUrl,
  })

  await store.appendEvent(projectId, event("analyze", "📦 Codebase package ready for download..."))

  // Build understanding object
  const understanding: ProjectUnderstanding = {
    sourceUrl: `https://github.com/${ghDoc.repoOwner}/${ghDoc.repoName}`,
    title: `${ghDoc.repoOwner}/${ghDoc.repoName}`,
    description: readme ? readme.slice(0, 500) : `Extending GitHub repository ${repoLabel}`,
    purpose: `Application extended from GitHub repository ${repoLabel}`,
    targetUsers: [],
    userRoles: [],
    pages: [],
    navigation: [],
    components: [],
    designSystem: { colors: [], typography: [] },
    contentStructure: [],
    assets: [],
    interactions: [],
    userFlows: [],
    observedFunctionality: [],
    inferredFunctionality: [],
    suggestedFeatures: [],
    dataEntities: [],
    backendRequirements: [],
    authenticationRequirements: [],
    screenshots: [],
    rawEvidenceReferences: [repoLabel, zipUrl],
  }

  await store.updateProject(projectId, {
    understanding,
    state: "analysis_complete",
  })

  await store.appendEvent(projectId, event("analyze", "✅ Repository analyzed! Generating specification with your changes..."))

  // Build prompt for extend mode
  const userRequest = ghDoc.userRequest || "Continue and improve the existing application."
  const readmeSection = readme ? `\n\nREADME:\n${readme}` : ""

  const ideaText = `You are continuing an existing application. The codebase is available at this URL (extract it first):
${zipUrl}

The user wants you to: ${userRequest}

${readmeSection}

Existing application structure:
${fileTree}

Instructions:
1. Download and extract the codebase from the URL above
2. Analyze the existing code structure
3. Implement the user's requested changes
4. Maintain compatibility with the existing codebase
5. Use the built-in database and authentication where appropriate
`

  const specification = await generateSpecificationFromIdea(ideaText, project.userId, projectId)

  await store.updateProject(projectId, {
    state: "plan_ready",
    specification,
    name: specification.title || project.name,
    error: undefined,
    pipelineRecovery: undefined,
  })

  await store.appendEvent(projectId, event("specify", "📋 Plan ready with your requested changes! Review and refine before starting the build."))
  await store.appendEvent(projectId, event("plan", "✨ App plan ready! Taking you to the Collaborate page to review and refine before building."))

  logger.info("pipeline.github", "extend mode complete — plan_ready", { projectId, zipUrl })
}
