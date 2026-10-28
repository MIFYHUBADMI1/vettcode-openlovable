import sharp from "sharp"
import { AppError } from "@/lib/errors"

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_PIXELS = 25_000_000
const formats = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const

export async function validateImage(file: Buffer, declaredMime: string) {
  if (!file.length || file.length > MAX_IMAGE_BYTES) {
    throw new AppError("IMAGE_UPLOAD_FAILED", "Choose a non-empty image no larger than 5MB.", 422)
  }
  try {
    const image = sharp(file, { animated: true, failOn: "warning", limitInputPixels: MAX_PIXELS }).timeout({ seconds: 10 })
    const metadata = await image.metadata()
    const format = metadata.format as keyof typeof formats
    if (!(format in formats) || formats[format] !== declaredMime) throw new Error()
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS || (metadata.pages ?? 1) > 100) throw new Error()
    // Decode every frame and discard metadata/trailing payloads before publication.
    const clean = await image.toFormat(format, format === "jpeg" ? { quality: 95 } : format === "webp" ? { lossless: true } : {}).toBuffer()
    if (clean.length > MAX_IMAGE_BYTES) throw new Error()
    return { file: clean, mimeType: formats[format], extension: format === "jpeg" ? "jpg" : format }
  } catch {
    throw new AppError("IMAGE_UPLOAD_FAILED", "Choose a valid PNG, JPEG, WEBP, or GIF matching its content type.", 422)
  }
}

export async function readImageFile(request: Request): Promise<File> {
  const limit = MAX_IMAGE_BYTES + 64 * 1024
  if (Number(request.headers.get("content-length")) > limit || !request.body) {
    throw new AppError("VALIDATION", "Upload is too large or empty.", 413)
  }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new AppError("VALIDATION", "Upload must be no larger than 5MB.", 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  let form: FormData
  try {
    form = await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData()
  } catch {
    throw new AppError("VALIDATION", "Please submit one image file.")
  }
  const file = form.get("file")
  if (!(file instanceof File) || [...form.values()].filter((value) => value instanceof File).length !== 1 || file.name.length > 180) {
    throw new AppError("VALIDATION", "Please submit one image with a filename of at most 180 characters.")
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new AppError("VALIDATION", "Choose a non-empty image no larger than 5MB.", 413)
  return file
}
