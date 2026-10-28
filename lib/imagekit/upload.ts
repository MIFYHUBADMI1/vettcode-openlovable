import { getImageKitConfig } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import { validateImage } from "@/lib/imagekit/validate-image"

export interface UploadResult {
  fileId: string
  filePath: string
  url: string
  width?: number
  height?: number
}

/**
 * Server-side proxy upload to ImageKit (spec section 8). Validates MIME
 * type and size before ever calling out, so bad/oversized files never leave
 * this process and never count against ImageKit usage.
 */
export async function uploadImageToImageKit(params: {
  file: Buffer
  fileName: string
  mimeType: string
  folder: string
}): Promise<UploadResult> {
  const image = await validateImage(params.file, params.mimeType)
  const stem = params.fileName.replace(/\.[^.]*$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 150) || "image"
  const fileName = `${stem}.${image.extension}`
  const config = getImageKitConfig()
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(image.file)], { type: image.mimeType }), fileName)
  form.append("fileName", fileName)
  form.append("folder", params.folder)
  form.append("useUniqueFileName", "true")
  form.append("overwriteFile", "false")

  const auth = Buffer.from(`${config.privateKey}:`).toString("base64")

  let response: Response
  try {
    response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    logger.error("imagekit.upload_network_error", "Image upload network error")
    throw new AppError("IMAGE_UPLOAD_FAILED")
  }

  if (!response.ok) {
    logger.error("imagekit.upload_failed", "ImageKit rejected upload", { status: response.status })
    throw new AppError("IMAGE_UPLOAD_FAILED")
  }

  const data = (await response.json()) as {
    fileId: string
    filePath: string
    url: string
    width?: number
    height?: number
  }

  try {
    const url = new URL(data.url)
    const endpoint = new URL(config.urlEndpoint)
    if (typeof data.fileId !== "string" || !data.fileId || typeof data.filePath !== "string" || !data.filePath.startsWith(`${params.folder}/`) || typeof data.url !== "string" || url.protocol !== "https:" || url.origin !== endpoint.origin || url.username || url.password) throw new Error()
  } catch {
    throw new AppError("IMAGE_UPLOAD_FAILED")
  }
  return {
    fileId: data.fileId,
    filePath: data.filePath,
    url: data.url,
    width: data.width,
    height: data.height,
  }
}
