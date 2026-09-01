import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { uploadImageToImageKit } from "@/lib/imagekit/upload"
import { setUserImage } from "@/lib/auth/users"
import { projectAssetsCol, providerUsageCol, ensureIndexes } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"

/** Uploads a new avatar image via ImageKit and records it as a project
 * asset + provider-usage entry (spec sections 8 & 9). */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return fail("VALIDATION", "No file provided.", 422)

    const buffer = Buffer.from(await file.arrayBuffer())
    await ensureIndexes()
    const usage = await providerUsageCol()

    let result
    try {
      result = await uploadImageToImageKit({
        file: buffer,
        fileName: file.name || "avatar",
        mimeType: file.type,
        folder: "/mirrorsite/avatars",
      })
    } catch (e) {
      await usage.insertOne({
        _id: new ObjectId(),
        id: `usage_${cryptoId()}`,
        provider: "imagekit",
        operation: "avatar_upload",
        userId: user.id,
        succeeded: false,
        createdAt: Date.now(),
      })
      throw e
    }

    await usage.insertOne({
      _id: new ObjectId(),
      id: `usage_${cryptoId()}`,
      provider: "imagekit",
      operation: "avatar_upload",
      userId: user.id,
      succeeded: true,
      createdAt: Date.now(),
    })

    const assets = await projectAssetsCol()
    await assets.insertOne({
      _id: new ObjectId(),
      id: `asset_${cryptoId()}`,
      userId: user.id,
      kind: "avatar",
      fileId: result.fileId,
      filePath: result.filePath,
      fileName: file.name || "avatar",
      url: result.url,
      mimeType: file.type,
      size: buffer.byteLength,
      width: result.width,
      height: result.height,
      createdAt: Date.now(),
    })

    await setUserImage(user.id, result.url, result.fileId)

    return ok({ imageUrl: result.url })
  } catch (e) {
    return handleRouteError("api.me.avatar", e)
  }
}
