import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { reserveCredits, releaseReservation, getAvailableCredits } from "@/lib/billing/credit-service"
import { getDeploymentCosts } from "@/lib/billing/runtime-config"
import { deployProject, isTotalumConfigured, getDeploymentStatus, getProject } from "@/lib/integrations/totalum/service"
import { publishEventsCol } from "@/lib/db/collections"
import { logger } from "@/lib/logging/logger"
import { ensureRuntimeProvisioned, environmentForLifecycle, RuntimeProvisioningError } from "@/lib/runtime/provisioning"
import type { ProjectEvent } from "@/lib/types/project"
import type { PublishEventDoc } from "@/lib/types/db"

/**
 * Deploy credit cost — admin-configurable via runtime settings
 * (lib/billing/runtime-config.ts). Falls back to 500 when the settings
 * store is unavailable.
 */
async function getDeployCredits(): Promise<number> {
  const costs = await getDeploymentCosts()
  return costs.deployCost
}

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * POST /api/projects/:id/deploy
 * Deploy a project to production (hosted subdomain).
 * Charges the admin-configured deploy credits for lifetime hosting.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    // Rate-limit deploy: 10 per day per user.
    await checkRateLimit({
      action: "project_deploy",
      identifier: user.id,
      limit: 10,
      windowMs: 24 * 60 * 60 * 1000,
    })

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (project.state === "building" || project.state === "deploying") return fail("BUSY", "Please wait for the current operation to finish.", 409)

    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Deployment service is not connected.", 503)

    // Check credits
    const deployCost = await getDeployCredits()
    const available = await getAvailableCredits(user.id)
    if (available < deployCost) return fail("INSUFFICIENT_CREDITS", `Deploying requires ${deployCost.toLocaleString()} credits. Available: ${available.toLocaleString()}.`, 402)

    // Check if already deployed
    try {
      const deployStatus = await getDeploymentStatus(project.totalumProjectId)
      if (deployStatus.status === "deploying") return fail("DEPLOYMENT_RUNNING", "A deployment is already in progress.", 409)
    } catch (err) {
      // If project not found in Totalum, the build may have failed or the project ID is invalid
      if (err instanceof Error && err.message.includes("PROJECT_NOT_FOUND")) {
        return fail("TOTALUM_PROJECT_NOT_FOUND", "This project wasn't found in the deployment service. Try rebuilding the project first.", 404)
      }
      // If we can't check status for other reasons, proceed with deploy
    }

    // Reserve credits
    const runId = cryptoId()
    const reserved = await reserveCredits({ userId: user.id, amount: deployCost, buildId: runId, reason: "Production deployment" })
    if (!reserved) return fail("INSUFFICIENT_CREDITS", "Could not reserve credits for deployment.", 402)

    // Deploy via Totalum
    const deployStartTime = Date.now()
    try {
      await store.updateProject(id, { state: "deploying" })
      await store.appendEvent(id, event("deploy", "Starting production deployment..."))

      const result = await deployProject(project.totalumProjectId)

      // Record deployment history entry (best-effort — never crash deploy)
      try {
        const deploymentRecord = {
          id: runId,
          startedAt: deployStartTime,
          status: "deploying" as const,
          creditsCharged: deployCost,
        }
        await store.appendDeploymentRecord(id, deploymentRecord)
      } catch (err) {
        console.error("[deploy] failed to record deployment history (non-fatal)", err)
      }

      // Track publish analytics event (best-effort)
      try {
        const peCol = await publishEventsCol()
        await peCol.insertOne({
          _id: new (await import("mongodb")).ObjectId(),
          id: runId,
          userId: user.id,
          projectId: id,
          projectName: project.name,
          eventType: "subdomain" as const,
          status: "started" as const,
          creditsCharged: deployCost,
          createdAt: deployStartTime,
        })
      } catch (err) {
        console.error("[deploy] failed to record publish analytics (non-fatal)", err)
      }

      await store.appendEvent(id, event("deploy", "Deployment started — publishing to production (typically 3–5 minutes)."))

      return ok({
        message: "Deployment started. This typically takes 3-5 minutes.",
        deployRunId: runId,
        creditsCharged: deployCost,
      })
    } catch (providerError) {
      // Refund on failure
      await releaseReservation({ userId: user.id, amount: deployCost, buildId: runId, reason: "Deployment failure" })

      // Better error message for project not found
      const errorMessage = providerError instanceof Error ? providerError.message : "Deployment failed"
      const isProjectNotFound = errorMessage.includes("PROJECT_NOT_FOUND") || errorMessage.includes("404")
      const userMessage = isProjectNotFound
        ? "This project wasn't found in the deployment service. The build may have failed or been deleted. Try rebuilding the project first."
        : errorMessage

      // Update history/analytics (best-effort)
      try {
        await store.updateDeploymentRecord(id, runId, { status: "failed", completedAt: Date.now(), error: userMessage })
      } catch (err) {
        console.error("[deploy] failed to update deployment history (non-fatal)", err)
      }
      try {
        const peCol = await publishEventsCol()
        await peCol.updateOne(
          { id: runId },
          { $set: { status: "failed", error: userMessage, durationMs: Date.now() - deployStartTime } },
        )
      } catch (err) {
        console.error("[deploy] failed to update publish analytics (non-fatal)", err)
      }
      await store.updateProject(id, { state: "ready" })
      await store.appendEvent(id, event("deploy", `Deployment failed: ${userMessage}`, "error"))

      throw new Error(userMessage)
    }
  } catch (e) {
    return handleRouteError("api.projects.deploy", e)
  }
}

/**
 * GET /api/projects/:id/deploy
 * Check deployment status.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)

    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Deployment service is not connected.", 503)

    try {
      const [deployStatus, totalumProject] = await Promise.all([
        getDeploymentStatus(project.totalumProjectId),
        getProject(project.totalumProjectId),
      ])

      // Sync deployment state back to Atai
      if (deployStatus.status === "success" && project.state === "deploying") {
        const productionUrl = totalumProject.productionProjectUrl
        // Update deployment history (best-effort)
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
            console.error("[deploy] failed to update deployment history (non-fatal)", err)
          }
          try {
            const peCol = await publishEventsCol()
            await peCol.updateOne(
              { id: latestDeploy.id },
              { $set: { status: "success", productionUrl, customDomain: totalumProject.customDomain?.hostname, durationMs: Date.now() - latestDeploy.startedAt } },
            )
          } catch (err) {
            console.error("[deploy] failed to update publish analytics (non-fatal)", err)
          }
        }
        await store.updateProject(id, {
          state: "ready",
          developmentUrl: productionUrl || project.developmentUrl,
        })
        await store.appendEvent(id, event("deploy", `Deployed to production${productionUrl ? `: ${productionUrl}` : ""}`))

        // Phase 8 — automatic runtime provisioning (production). Same
        // idempotent service as build completion; the deployed application
        // must hold a production-scoped runtime credential.
        if (isTotalumConfigured()) {
          try {
            const persisted = (await store.getProject(id)) ?? project
            await ensureRuntimeProvisioned(persisted, environmentForLifecycle("production"))
          } catch (e) {
            if (!(e instanceof RuntimeProvisioningError && e.reason === "NO_GENERATED_APP")) {
              logger.error("api.projects.deploy.status", "runtime provisioning failed (non-fatal)", {
                id,
                reason: e instanceof RuntimeProvisioningError ? e.reason : "UNKNOWN",
              })
              await store.appendEvent(id, event("runtime", "Runtime setup failed — you can retry from settings.", "warn"))
            }
          }
        }
      } else if (deployStatus.status === "error" && project.state === "deploying") {
        const latestDeploy = [...(project.deploymentHistory || [])].reverse().find(d => d.status === "deploying")
        if (latestDeploy) {
          try {
            await store.updateDeploymentRecord(id, latestDeploy.id, {
              status: "failed",
              completedAt: Date.now(),
              error: "Deployment failed",
            })
          } catch (err) {
            console.error("[deploy] failed to update deployment history (non-fatal)", err)
          }
          try {
            const peCol = await publishEventsCol()
            await peCol.updateOne(
              { id: latestDeploy.id },
              { $set: { status: "failed", error: "Deployment failed", durationMs: Date.now() - latestDeploy.startedAt } },
            )
          } catch (err) {
            console.error("[deploy] failed to update publish analytics (non-fatal)", err)
          }
        }
        await store.updateProject(id, { state: "ready" })
        await store.appendEvent(id, event("deploy", "Deployment failed.", "error"))
      }

      return ok({
        status: deployStatus.status,
        createdAt: deployStatus.createdAt,
        versionId: deployStatus.versionId,
        productionUrl: totalumProject.productionProjectUrl,
        customDomain: totalumProject.customDomain,
      })
    } catch (err) {
      // Handle project not found - reset state to ready
      if (err instanceof Error && (err.message.includes("PROJECT_NOT_FOUND") || err.message.includes("404"))) {
        // If the project was in deploying state, reset it
        if (project.state === "deploying") {
          await store.updateProject(id, { state: "ready" })
          await store.appendEvent(id, event("deploy", "Deployment failed: Project not found in deployment service.", "error"))
        }
        const latest = [...(project.deploymentHistory || [])].reverse().find((d) => d.productionUrl || d.customDomain)
        return ok({
          status: project.deployment?.status === "success" ? "success" : project.state === "deploying" ? "deploying" : null,
          productionUrl: project.deployment?.productionUrl ?? latest?.productionUrl ?? project.developmentUrl,
          customDomain: latest?.customDomain ? { hostname: latest.customDomain, status: latest.status } : null,
        })
      }
      return handleRouteError("api.projects.deploy.status", err)
    }
  } catch (e) {
    return handleRouteError("api.projects.deploy.status", e)
  }
}
