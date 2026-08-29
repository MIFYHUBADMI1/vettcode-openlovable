import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { uploadImageToImageKit } from "@/lib/imagekit/upload"
import { projectAssetsCol, ensureIndexes } from "@/lib/db/collections"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return fail("VALIDATION", "No image file provided.", 422)
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadImageToImageKit({ file: buffer, fileName: file.name || "project-asset", mimeType: file.type, folder: `/mirrorsite/projects/${id}` })
    await ensureIndexes()
    await (await projectAssetsCol()).insertOne({ _id: new ObjectId(), id: `asset_${cryptoId()}`, userId: user.id, projectId: id, kind: "upload", fileId: result.fileId, filePath: result.filePath, fileName: file.name || "project-asset", url: result.url, mimeType: file.type, size: buffer.byteLength, width: result.width, height: result.height, createdAt: Date.now() })
    return ok({ asset: result })
  } catch (error) { return handleRouteError("api.projects.assets.upload", error) }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    const stored = await (await projectAssetsCol()).find({ projectId: id }).sort({ createdAt: -1 }).toArray()
    return ok({ assets: [...(project.understanding?.assets ?? []), ...stored.filter((item) => item.kind === "asset" || item.kind === "upload").map((item) => item.url)], screenshots: [...(project.understanding?.screenshots ?? []), ...stored.filter((item) => item.kind === "screenshot").map((item) => item.url)] })
  } catch (error) {
    return handleRouteError("api.projects.assets", error)
  }
}
