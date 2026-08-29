import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { reconcileCredits } from "@/lib/credits/credits"
import { getAgentStatus, getProject, resolveDevelopmentUrl } from "@/lib/integrations/totalum/service"
import type { ConversationMessage, ProjectEvent } from "@/lib/types/project"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * Polled by the workspace while a build is running. Syncs the live Totalum
 * agent status into MirrorSite's own project state and resolves the preview URL
 * when the build completes (spec sections 10, 11 & 30).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const userId = user.id
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== userId) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    // Nothing to sync unless a Totalum project exists and we're mid-build.
    const active = project.state === "building" || project.state === "deploying"
    if (!project.totalumProjectId || !active) {
      return ok({ state: project.state, developmentUrl: project.developmentUrl, events: project.events.slice(-30) })
    }

    try {
      const status = await getAgentStatus(project.totalumProjectId)
      if (status.status === "done") {
        const totalumProject = await getProject(project.totalumProjectId)
        const devUrl = resolveDevelopmentUrl(totalumProject)
        await store.updateProject(id, { state: "ready", developmentUrl: devUrl })
        await store.appendEvent(id, event("build", "Build complete — your app is ready to preview"))

        // Reconcile credits against actual provider usage when available.
        const runs = await store.listBuildRuns(id)
        const run = runs.find((r) => r.totalumProjectId === project.totalumProjectId && r.status === "running")
        if (run) {
          await store.updateBuildRun(run.id, { status: "succeeded", completedAt: Date.now() })
          // Without a documented usage figure we keep the reservation as-is;
          // reconcileCredits is a no-op when reserved === actual.
          await reconcileCredits(userId, run.creditsReserved, run.creditsReserved, run.id)
        }
        // Surface any assistant messages from the agent into the conversation.
        for (const m of status.messages ?? []) {
          if (m.role === "assistant" && m.content) {
            const msg: ConversationMessage = { id: cryptoId(), role: "assistant", content: m.content, at: Date.now() }
            await store.appendMessage(id, msg)
          }
        }
        return ok({ state: "ready", developmentUrl: devUrl, progress: 100, events: (await store.getProject(id))!.events.slice(-30) })
      }

      if (status.status === "failed") {
        await store.updateProject(id, { state: "build_failed", error: status.error })
        await store.appendEvent(id, event("build", "Build failed", "error"))
        return ok({ state: "build_failed", events: (await store.getProject(id))!.events.slice(-30) })
      }

      // still running/queued
      return ok({
        state: "building",
        progress: status.progress ?? null,
        agentStatus: status.status,
        events: project.events.slice(-30),
      })
    } catch (providerError) {
      // Transient provider errors should not corrupt persisted state.
      return ok({ state: project.state, transient: true, message: "Waiting for the builder…", events: project.events.slice(-30) })
    }
  } catch (e) {
    return handleRouteError("api.projects.status", e)
  }
}
