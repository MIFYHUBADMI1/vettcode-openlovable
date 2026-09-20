import { postJson } from "@/lib/client/api"
import type { Project } from "@/lib/types/project"
import type { PendingStart } from "@/lib/auth/client-intent"
import { extractGithubRepo, extractWebsiteUrl } from "@/lib/start/detect-input"

export function buildCreatePayload(pending: PendingStart) {
  const prompt = pending.prompt.trim()
  const mode = pending.mode ?? "idea"
  const pipelineMode = pending.pipelineMode === "legacy" ? "legacy" : "heavy"

  if (mode === "github") {
    const repo = extractGithubRepo(prompt) ?? prompt
    const match = repo.match(/(?:github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i)
    const words = prompt.replace(/https?:\/\/\S+/gi, " ").trim().split(/\s+/).filter(Boolean)
    const hasInstruction = words.length >= 4
    return {
      mode: "github" as const,
      githubRepoOwner: match?.[1],
      githubRepoName: match?.[2],
      githubSubMode: hasInstruction ? ("extend" as const) : ("clone" as const),
      userRequest: hasInstruction ? prompt : undefined,
      idea: prompt,
      pipelineMode,
      skipAnalysis: true,
      idempotencyKey: pending.idempotencyKey,
    }
  }

  if (mode === "website" || mode === "url") {
    return {
      mode: "website" as const,
      url: extractWebsiteUrl(prompt) ?? prompt,
      idea: prompt,
      pipelineMode,
      skipAnalysis: true,
      idempotencyKey: pending.idempotencyKey,
    }
  }

  return {
    mode: "scratch" as const,
    idea: prompt,
    pipelineMode,
    skipAnalysis: true,
    idempotencyKey: pending.idempotencyKey,
  }
}

export async function createProjectFromPending(pending: PendingStart) {
  const payload = buildCreatePayload(pending)
  return postJson<{ project: Project }>("/api/projects", payload)
}
