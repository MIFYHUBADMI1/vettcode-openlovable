import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { reserveCredits, releaseReservation, getAvailableCredits } from "@/lib/billing/credit-service"
import { deployProject, isTotalumConfigured, getDeploymentStatus, getProject } from "@/lib/integrations/totalum/service"
import { publishEventsCol } from "@/lib/db/collections"
import { logger } from "@/lib/logging/logger"
import type { ProjectEvent } from "@/lib/types/project"
import type { PublishEventDoc } from "@/lib/types/db"

const DEPLOY_CREDITS = 500

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * POST /api/projects/:id/deploy
 * Deploy a project to production (hosted subdomain).
 * Charges 500 credits for lifetime hosting.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    // Rate-limit deploy: 10 per day per user (it costs 500 credits per deploy).
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
    const available = await getAvailableCredits(user.id)
    if (available < DEPLOY_CREDITS) return fail("INSUFFICIENT_CREDITS", `Deploying requires ${DEPLOY_CREDITS} credits. Available: ${available.toLocaleString()}.`, 402)

    // Check if already deployed
    try {
      const deployStatus = await getDeploymentStatus(project.totalumProjectId)
      if (deployStatus.status === "deploying") return fail("DEPLOYMENT_RUNNING", "A deployment is already in progress.", 409)
    } catch {
      // If we can't check status, proceed with deploy
    }

    // Reserve credits
    const runId = cryptoId()
    const reserved = await reserveCredits({ userId: user.id, amount: DEPLOY_CREDITS, buildId: runId, reason: "Production deployment" })
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
          creditsCharged: DEPLOY_CREDITS,
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
          creditsCharged: DEPLOY_CREDITS,
          createdAt: deployStartTime,
        })
      } catch (err) {
        console.error("[deploy] failed to record publish analytics (non-fatal)", err)
      }

      await store.appendEvent(id, event("deploy", "Deployment started — publishing to production (typically 3–5 minutes)."))

      return ok({
        message: "Deployment started. This typically takes 3-5 minutes.",
        deployRunId: runId,
        creditsCharged: DEPLOY_CREDITS,
      })
    } catch (providerError) {
      // Refund on failure
      await releaseReservation({ userId: user.id, amount: DEPLOY_CREDITS, buildId: runId, reason: "Deployment failure" })
      // Update history/analytics (best-effort)
      try {
        await store.updateDeploymentRecord(id, runId, { status: "failed", completedAt: Date.now(), error: providerError instanceof Error ? providerError.message : "Deployment failed" })
      } catch (err) {
        console.error("[deploy] failed to update deployment history (non-fatal)", err)
      }
      try {
        const peCol = await publishEventsCol()
        await peCol.updateOne(
          { id: runId },
          { $set: { status: "failed", error: providerError instanceof Error ? providerError.message : "Deployment failed", durationMs: Date.now() - deployStartTime } },
        )
      } catch (err) {
        console.error("[deploy] failed to update publish analytics (non-fatal)", err)
      }
      await store.updateProject(id, { state: "ready" })
      await store.appendEvent(id, event("deploy", "Deployment failed. Credits were refunded.", "error"))
      throw providerError
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

    const [deployStatus, totalumProject] = await Promise.all([
      getDeploymentStatus(project.totalumProjectId),
      getProject(project.totalumProjectId),
    ])

    // Sync deployment state back to MirrorSite
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
  } catch (e) {
    return handleRouteError("api.projects.deploy.status", e)
  }
}
