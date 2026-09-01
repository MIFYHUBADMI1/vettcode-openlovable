import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { reconcileCredits } from "@/lib/credits/credits"
import { processMilestoneCheck } from "@/lib/referrals/referrals"
import { getAgentStatus, getProject, resolveDevelopmentUrl, getDeploymentStatus, getFullConversation } from "@/lib/integrations/totalum/service"
import { publishEventsCol } from "@/lib/db/collections"
import { logger } from "@/lib/logging/logger"
import type { ConversationMessage, ProjectEvent, BuildSummary } from "@/lib/types/project"

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
    if (!active) {
      console.log("[status] not active, returning stored state", { id, state: project.state })

      // Backfill buildSummary for projects built before this field existed.
      // Only fetch once — once persisted, subsequent requests return it from MongoDB.
      let buildSummary = project.buildSummary
      if (!buildSummary && project.totalumProjectId && (project.state === "ready" || project.state === "build_complete")) {
        try {
          console.log("[status] backfilling buildSummary from Totalum", { id })
          const fullConv = await getFullConversation(project.totalumProjectId)
          const finishedMsg = [...fullConv.conversation]
            .reverse()
            .find((m) => m.messageType === "finished")
          if (finishedMsg) {
            buildSummary = {
              message: finishedMsg.message,
              createdAt: Date.now(),
              versionId: finishedMsg.versionId,
              secretKeysNeeded: finishedMsg.secretKeysNeeded,
            }
            // Persist so we never need to fetch again
            await store.updateProject(id, { buildSummary })
            console.log("[status] buildSummary backfilled and persisted", { id })
          }
        } catch (err) {
          console.error("[status] failed to backfill buildSummary (non-fatal)", err)
        }
      }

      return ok({
        state: project.state,
        developmentUrl: project.developmentUrl,
        specSanitized: project.specSanitized,
        events: project.events.slice(-30),
        project: {
          id: project.id,
          name: project.name,
          mode: project.mode,
          state: project.state,
          sourceUrl: project.sourceUrl,
          understanding: project.understanding,
          specification: project.specification,
          conversation: project.conversation.slice(-20),
          buildSummary,
        },
      })
    }

    // RECOVERY: project is stuck in building/deploying but has no totalumProjectId.
    // This happens when the auto-launch from the pipeline failed to persist the
    // totalumProjectId. Reset to specification_ready so the user can retry.
    if (!project.totalumProjectId) {
      console.warn("[status] orphaned build state — no totalumProjectId, resetting", { id, state: project.state })
      await store.updateProject(id, { state: "specification_ready" })
      await store.appendEvent(id, event("build", "Build lost its connection to the builder. Please try building again.", "warn"))
      return ok({
        state: "specification_ready",
        events: (await store.getProject(id))!.events.slice(-30),
        project: {
          id: project.id,
          name: project.name,
          mode: project.mode,
          state: "specification_ready",
          sourceUrl: project.sourceUrl,
          understanding: project.understanding,
          specification: project.specification,
          conversation: project.conversation.slice(-20),
        },
      })
    }

    try {
      // Handle deployment status separately from agent status
      if (project.state === "deploying") {
        console.log("[status] polling deployment status", { id, totalumProjectId: project.totalumProjectId })
        const deployStatus = await getDeploymentStatus(project.totalumProjectId)
        console.log("[status] deployment status", { id, deployStatus: deployStatus.status })

        if (deployStatus.status === "success") {
          const totalumProject = await getProject(project.totalumProjectId)
          const productionUrl = totalumProject.productionProjectUrl
          console.log("[status] deployment success", { id, productionUrl })
          // Update latest deploying entry in history (best-effort)
          const latestDeploy = [...(project.deploymentHistory || [])].reverse().find(d => d.status === "deploying")
          if (latestDeploy) {
            try {
              await store.updateDeploymentRecord(id, latestDeploy.id, {
                status: "success",
                completedAt: Date.now(),
                productionUrl,
                customDomain: totalumProject.customDomain?.hostname,
              })
            } catch (err) {
              console.error("[status] failed to update deployment history (non-fatal)", err)
            }
            try {
              const peCol = await publishEventsCol()
              await peCol.updateOne(
                { id: latestDeploy.id },
                { $set: { status: "success", productionUrl, customDomain: totalumProject.customDomain?.hostname, durationMs: Date.now() - latestDeploy.startedAt } },
              )
            } catch (err) {
              console.error("[status] failed to update publish analytics (non-fatal)", err)
            }
          }
          await store.updateProject(id, {
            state: "ready",
            developmentUrl: productionUrl || project.developmentUrl,
          })
          await store.appendEvent(id, event("deploy", `Deployed to production${productionUrl ? `: ${productionUrl}` : ""}`))
          const updated = await store.getProject(id)
          return ok({
            state: "ready",
            developmentUrl: productionUrl || project.developmentUrl,
            events: updated!.events.slice(-30),
            project: {
              id: updated!.id,
              name: updated!.name,
              mode: updated!.mode,
              state: updated!.state,
              sourceUrl: updated!.sourceUrl,
              understanding: updated!.understanding,
              specification: updated!.specification,
              conversation: updated!.conversation.slice(-20),
              deploymentHistory: updated!.deploymentHistory,
              totalumProjectId: updated!.totalumProjectId,
            },
          })
        }

        if (deployStatus.status === "error") {
          const latestDeploy = [...(project.deploymentHistory || [])].reverse().find(d => d.status === "deploying")
          if (latestDeploy) {
            try {
              await store.updateDeploymentRecord(id, latestDeploy.id, {
                status: "failed",
                completedAt: Date.now(),
                error: "Deployment failed",
              })
            } catch (err) {
              console.error("[status] failed to update deployment history (non-fatal)", err)
            }
            try {
              const peCol = await publishEventsCol()
              await peCol.updateOne(
                { id: latestDeploy.id },
                { $set: { status: "failed", error: "Deployment failed", durationMs: Date.now() - latestDeploy.startedAt } },
              )
            } catch (err) {
              console.error("[status] failed to update publish analytics (non-fatal)", err)
            }
          }
          await store.updateProject(id, { state: "ready" })
          await store.appendEvent(id, event("deploy", "Deployment failed.", "error"))
          const updated = await store.getProject(id)
          return ok({
            state: "ready",
            events: updated!.events.slice(-30),
            project: {
              id: updated!.id,
              name: updated!.name,
              mode: updated!.mode,
              state: updated!.state,
              sourceUrl: updated!.sourceUrl,
              understanding: updated!.understanding,
              specification: updated!.specification,
              conversation: updated!.conversation.slice(-20),
            },
          })
        }

        // Still deploying
        return ok({
          state: "deploying",
          progress: null,
          events: project.events.slice(-30),
          project: {
            id: project.id,
            name: project.name,
            mode: project.mode,
            state: project.state,
            sourceUrl: project.sourceUrl,
            understanding: project.understanding,
            specification: project.specification,
            conversation: project.conversation.slice(-20),
          },
        })
      }

      console.log("[status] polling Totalum", { id, totalumProjectId: project.totalumProjectId })
      const status = await getAgentStatus(project.totalumProjectId)
      console.log("[status] Totalum responded", { id, agentStatus: status.status, progress: status.progress, messageCount: status.messages?.length })

      if (status.status === "done") {
        console.log("[status] build done, resolving dev URL", { id, totalumProjectId: project.totalumProjectId })
        const totalumProject = await getProject(project.totalumProjectId)
        const devUrl = resolveDevelopmentUrl(totalumProject)
        console.log("[status] resolved dev URL", { id, devUrl })

        // Fetch the full conversation from Totalum to extract the AI's
        // post-build summary ("finished" messages with important info like
        // credentials, what's included, next steps).
        let buildSummary: BuildSummary | undefined
        try {
          const fullConv = await getFullConversation(project.totalumProjectId)
          // The "finished" message contains the AI's final summary — the most
          // important message for the user (login creds, what's built, etc.)
          const finishedMsg = [...fullConv.conversation]
            .reverse()
            .find((m) => m.messageType === "finished")
          if (finishedMsg) {
            buildSummary = {
              message: finishedMsg.message,
              createdAt: Date.now(),
              versionId: finishedMsg.versionId,
              secretKeysNeeded: finishedMsg.secretKeysNeeded,
            }
            console.log("[status] captured build summary", { id, hasSecrets: Boolean(finishedMsg.secretKeysNeeded) })
          }
          // Also persist all conversation messages from the build
          for (const m of fullConv.conversation) {
            if (m.author === "agent" && m.message) {
              const msg: ConversationMessage = {
                id: cryptoId(),
                role: "assistant",
                content: m.message,
                at: Date.now(),
              }
              await store.appendMessage(id, msg)
            }
          }
        } catch (err) {
          // Full conversation fetch is best-effort — don't fail the build
          console.error("[status] failed to fetch full conversation (non-fatal)", err)
          // Fallback: surface any messages from the status response
          for (const m of status.messages ?? []) {
            if (m.role === "assistant" && m.content) {
              const msg: ConversationMessage = { id: cryptoId(), role: "assistant", content: m.content, at: Date.now() }
              await store.appendMessage(id, msg)
            }
          }
        }

        await store.updateProject(id, {
          state: "ready",
          developmentUrl: devUrl,
          ...(buildSummary ? { buildSummary } : {}),
        })
        await store.appendEvent(id, event("build", "Build complete — your app is ready to preview"))

        // Reconcile credits against actual provider usage when available.
        const runs = await store.listBuildRuns(id)
        const run = runs.find((r) => r.totalumProjectId === project.totalumProjectId && r.status === "running")
        if (run) {
          await store.updateBuildRun(run.id, { status: "succeeded", completedAt: Date.now() })
          await reconcileCredits(userId, run.creditsReserved, run.creditsReserved, run.id)

          // Check referral milestone after successful build
          const qualifyingUsage = run.creditsConsumed ?? run.creditsReserved
          if (qualifyingUsage > 0) {
            await processMilestoneCheck(userId, qualifyingUsage).catch((e) => {
              console.error("[status] referral milestone check failed", e)
            })
          }
        }

        const updated = await store.getProject(id)
        return ok({
          state: "ready",
          developmentUrl: devUrl,
          progress: 100,
          events: updated!.events.slice(-30),
          project: {
            id: updated!.id,
            name: updated!.name,
            mode: updated!.mode,
            state: updated!.state,
            sourceUrl: updated!.sourceUrl,
            understanding: updated!.understanding,
            specification: updated!.specification,
            conversation: updated!.conversation.slice(-20),
            buildSummary: updated!.buildSummary,
          },
        })
      }

      if (status.status === "failed") {
        console.log("[status] build failed", { id, error: status.error })
        await store.updateProject(id, { state: "build_failed", error: status.error })
        await store.appendEvent(id, event("build", "Build failed", "error"))
        const updated = await store.getProject(id)
        return ok({
          state: "build_failed",
          events: updated!.events.slice(-30),
          project: {
            id: updated!.id,
            name: updated!.name,
            mode: updated!.mode,
            state: updated!.state,
            sourceUrl: updated!.sourceUrl,
            understanding: updated!.understanding,
            specification: updated!.specification,
            conversation: updated!.conversation.slice(-20),
          },
        })
      }

      // still running/queued
      return ok({
        state: "building",
        progress: status.progress ?? null,
        agentStatus: status.status,
        realtimeConversation: status.realtimeConversation ?? [],
        events: project.events.slice(-30),
        project: {
          id: project.id,
          name: project.name,
          mode: project.mode,
          state: project.state,
          sourceUrl: project.sourceUrl,
          understanding: project.understanding,
          specification: project.specification,
          conversation: project.conversation.slice(-20),
        },
      })
    } catch (providerError) {
      console.error("[status] provider error", { id, message: (providerError as Error).message })
      logger.error("api.projects.status", "provider error", { id, message: (providerError as Error).message })
      // Transient provider errors should not corrupt persisted state.
      return ok({ state: project.state, transient: true, message: "Waiting for the builder…", events: project.events.slice(-30) })
    }
  } catch (e) {
    return handleRouteError("api.projects.status", e)
  }
}
