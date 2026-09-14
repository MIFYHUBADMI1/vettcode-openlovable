import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { usersCol, projectGitHubCol } from "@/lib/db/collections"
import { getReadme, getRepoTree, getFileContent, GitHubApiError } from "@/lib/integrations/github/client"
import { autoLaunchBuild } from "@/lib/analysis/pipeline"
import { generateSpecificationFromIdea } from "@/lib/analysis/specification"
import type { ProjectEvent } from "@/lib/types/project"
import type { ProjectUnderstanding } from "@/lib/types/understanding"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go",
  ".rb", ".java", ".cs", ".php", ".html", ".css",
  ".json", ".md", ".mdx", ".yaml", ".yml",
])

const MAX_FILES   = 500
const MAX_BYTES   = 2 * 1024 * 1024 // 2 MB

/**
 * Runs the GitHub-repo analysis pipeline for a project with mode "github".
 * Fetches README + code files from the connected repo and uses them as
 * the planning source in place of Firecrawl website crawling.
 */
export async function runGitHubAnalysis(projectId: string): Promise<void> {
  logger.info("pipeline.github", "starting", { projectId })

  const project = await store.getProject(projectId)
  if (!project) {
    logger.error("pipeline.github", "project not found", { projectId })
    return
  }

  try {
    await store.updateProject(projectId, { state: "analyzing" })
    await store.appendEvent(projectId, event("analyze", "🔍 Reading your GitHub repository..."))

    // Get GitHub connection doc
    const ghCol = await projectGitHubCol()
    const ghDoc = await ghCol.findOne({ projectId, mode: "build-from" })
    if (!ghDoc) {
      await store.updateProject(projectId, { state: "build_failed", error: "No GitHub repo connected for this project." })
      await store.appendEvent(projectId, event("analyze", "❌ No GitHub repository connected. Please connect one first.", "error"))
      return
    }

    // Get user's GitHub token
    const userDoc = await (await usersCol()).findOne({ id: project.userId })
    if (!userDoc?.githubAccessToken) {
      await store.updateProject(projectId, { state: "build_failed", error: "GitHub access token missing." })
      await store.appendEvent(projectId, event("analyze", "❌ GitHub account not connected. Please sign in with GitHub.", "error"))
      return
    }

    const { githubAccessToken: token, repoOwner, repoName, branch } = { ...userDoc, ...ghDoc }
    const repoLabel = `${ghDoc.repoOwner}/${ghDoc.repoName}`

    await store.appendEvent(projectId, event("analyze", `📂 Fetching repository contents from ${repoLabel}...`))

    // Fetch README
    const readme = await getReadme(token, ghDoc.repoOwner, ghDoc.repoName)
    logger.info("pipeline.github", "readme fetched", { projectId, hasReadme: Boolean(readme) })

    // Fetch file tree
    let tree
    try {
      tree = await getRepoTree(token, ghDoc.repoOwner, ghDoc.repoName, ghDoc.branch)
    } catch (e) {
      if (e instanceof GitHubApiError && e.status === 409) {
        // Empty repo
        await store.updateProject(projectId, { state: "build_failed", error: "The GitHub repository is empty." })
        await store.appendEvent(projectId, event("analyze", "❌ The repository appears to be empty.", "error"))
        return
      }
      throw e
    }

    // Filter to code files only, respecting limits
    const codeFiles = tree.filter(f => {
      if (f.type !== "blob") return false
      const ext = "." + f.path.split(".").pop()!.toLowerCase()
      return CODE_EXTENSIONS.has(ext)
    }).slice(0, MAX_FILES)

    await store.appendEvent(projectId, event("analyze", `📄 Found ${codeFiles.length} code files. Reading contents...`))

    // Fetch file contents up to 2MB total
    const fileContents: string[] = []
    let totalBytes = 0
    for (const file of codeFiles) {
      if (totalBytes >= MAX_BYTES) break
      try {
        const content = await getFileContent(token, ghDoc.repoOwner, ghDoc.repoName, file.path)
        const bytes   = Buffer.byteLength(content, "utf8")
        if (totalBytes + bytes > MAX_BYTES) break
        fileContents.push(`// File: ${file.path}\n${content}`)
        totalBytes += bytes
      } catch {
        // Skip unreadable files
      }
    }

    logger.info("pipeline.github", "files fetched", { projectId, count: fileContents.length, bytes: totalBytes })
    await store.appendEvent(projectId, event("analyze", `🧠 Analysing ${fileContents.length} files (${Math.round(totalBytes / 1024)}KB) with AI...`))

    // Build analysis prompt from README + code files
    const analysisInput = [
      readme ? `# README\n\n${readme}` : "",
      fileContents.join("\n\n---\n\n"),
    ].filter(Boolean).join("\n\n===\n\n")

    // Store a minimal understanding object
    const understanding: ProjectUnderstanding = {
      sourceUrl: `https://github.com/${ghDoc.repoOwner}/${ghDoc.repoName}`,
      title:     `${ghDoc.repoOwner}/${ghDoc.repoName}`,
      description: readme ? readme.slice(0, 500) : `GitHub repository: ${repoLabel}`,
      purpose:   `Application built from GitHub repository ${repoLabel}`,
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
    await store.appendEvent(projectId, event("analyze", `✅ Repository analysed! Generating application specification...`))

    // Generate spec using the repo content as the idea/description
    const ideaText = `Build an application based on this GitHub repository (${repoLabel}).\n\n${analysisInput.slice(0, 8000)}`
    const specification = await generateSpecificationFromIdea(ideaText, project.userId, projectId)

    await store.updateProject(projectId, {
      state: "specification_ready",
      specification,
      name: specification.title || project.name,
    })
    await store.appendEvent(projectId, event("specify", `📋 Specification ready! Auto-launching build...`))

    // Auto-launch Totalum build
    await autoLaunchBuild(projectId)

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logger.error("pipeline.github", "failed", { projectId, error: message })
    await store.updateProject(projectId, { state: "build_failed", error: "Failed to analyse GitHub repository." })
    await store.appendEvent(projectId, event("analyze", `❌ Failed to read repository: ${message}`, "error"))
  }
}
