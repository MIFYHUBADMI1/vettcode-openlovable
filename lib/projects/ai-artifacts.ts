import "server-only"
import { store } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { MAX_AI_ARTIFACTS, clipArtifactText, type AIArtifact } from "@/lib/types/ai-artifacts"

/** Dedupe scope: a new run replaces the artifact a previous run produced for
 * the same stage, but failures keep their own slot (the exact raw text a stage
 * returned is evidence, not a duplicate). */
function artifactKey(a: AIArtifact): string {
  return `${a.kind}:${a.stage ?? ""}`
}

/**
 * Persist AI stage outputs on the project.
 *
 * Never throws: artifact capture is observability, and must not be able to
 * break planning. Existing artifacts of the same kind+stage are replaced by
 * the newest output; everything else is kept, newest first, capped.
 */
export async function recordAIArtifacts(projectId: string, artifacts: AIArtifact[]): Promise<void> {
  const incoming = artifacts
    .filter((a): a is AIArtifact => Boolean(a))
    .map((a) => (a.rawText ? { ...a, rawText: clipArtifactText(a.rawText) } : a))
  if (incoming.length === 0) return

  try {
    const project = await store.getProject(projectId)
    const existing = project?.aiArtifacts ?? []
    const incomingKeys = new Set(incoming.map(artifactKey))
    const kept = existing.filter((a) => !incomingKeys.has(artifactKey(a)))
    const merged = [...incoming, ...kept].slice(0, MAX_AI_ARTIFACTS)
    await store.updateProject(projectId, { aiArtifacts: merged })
  } catch (error) {
    logger.warn("ai.artifacts", "failed to persist AI artifacts", {
      projectId,
      count: incoming.length,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
