import { getImageKitConfig } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

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
  if (!ALLOWED_MIME.has(params.mimeType)) {
    throw new AppError("IMAGE_UPLOAD_FAILED", "Only PNG, JPEG, WEBP, or GIF images are allowed.")
  }
  if (params.file.byteLength > MAX_BYTES) {
    throw new AppError("IMAGE_UPLOAD_FAILED", "Images must be smaller than 5MB.")
  }

  const config = getImageKitConfig()
  const form = new FormData()
  form.append("file", new Blob([params.file], { type: params.mimeType }), params.fileName)
  form.append("fileName", params.fileName)
  form.append("folder", params.folder)
  form.append("useUniqueFileName", "true")

  const auth = Buffer.from(`${config.privateKey}:`).toString("base64")

  let response: Response
  try {
    response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form,
    })
  } catch (error) {
    logger.error("imagekit.upload_network_error", "Image upload network error", { error: String(error) })
    throw new AppError("IMAGE_UPLOAD_FAILED")
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    logger.error("imagekit.upload_failed", "ImageKit rejected upload", { status: response.status, body })
    throw new AppError("IMAGE_UPLOAD_FAILED")
  }

  const data = (await response.json()) as {
    fileId: string
    filePath: string
    url: string
    width?: number
    height?: number
  }

  return {
    fileId: data.fileId,
    filePath: data.filePath,
    url: data.url,
    width: data.width,
    height: data.height,
  }
}
