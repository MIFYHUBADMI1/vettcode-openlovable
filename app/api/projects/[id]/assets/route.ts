import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { uploadImageToImageKit } from "@/lib/imagekit/upload"
import { readImageFile } from "@/lib/imagekit/validate-image"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { acquireAiLease } from "@/lib/api/ai-lease"
import { logger } from "@/lib/logging/logger"
import { projectAssetsCol, ensureIndexes } from "@/lib/db/collections"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let release: (() => Promise<void>) | undefined
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    await checkRateLimit({ action: "image_upload", identifier: user.id, limit: 20, windowMs: 60_000 })
    const file = await readImageFile(request)
    release = await acquireAiLease(user.id, "image_upload")
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadImageToImageKit({ file: buffer, fileName: file.name || "project-asset", mimeType: file.type, folder: `/Atai/projects/${id}` })
    await ensureIndexes()
    await (await projectAssetsCol()).insertOne({ _id: new ObjectId(), id: `asset_${cryptoId()}`, userId: user.id, projectId: id, kind: "upload", fileId: result.fileId, filePath: result.filePath, fileName: file.name || "project-asset", url: result.url, mimeType: file.type, size: buffer.byteLength, width: result.width, height: result.height, createdAt: Date.now() })
    return ok({ asset: result })
  } catch (error) { return handleRouteError("api.projects.assets.upload", error) }
  finally {
    try { await release?.() } catch { logger.warn("image.upload", "Lease cleanup failed; expiry will recover the slot") }
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    // Fetch project and assets in parallel to reduce total latency.
    const [project, stored] = await Promise.all([
      store.getProject(id),
      (await projectAssetsCol()).find({ projectId: id }).sort({ createdAt: -1 }).toArray(),
    ])
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    return ok({
      assets: [...(project.understanding?.assets ?? []), ...stored.filter((item) => item.kind === "asset" || item.kind === "upload").map((item) => item.url)],
      screenshots: [...(project.understanding?.screenshots ?? []), ...stored.filter((item) => item.kind === "screenshot").map((item) => item.url)],
    })
  } catch (error) {
    return handleRouteError("api.projects.assets", error)
  }
}
