import { AppError } from "@/lib/errors"

export async function readAuthBody(request: Request): Promise<Record<string, unknown>> {
  return readJsonBody(request, 8192)
}

export async function readJsonBody(request: Request, limit: number, deadlineMs = 15_000): Promise<Record<string, unknown>> {
  const tooLarge = () => new AppError("VALIDATION", "Request body is too large.", 413)
  const timedOut = () => new AppError("VALIDATION", "The request timed out. Please try again.", 408)
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge()
  if (!request.body) throw new AppError("VALIDATION")
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(deadlineMs)].filter((signal): signal is AbortSignal => Boolean(signal)))
  const abort = () => { void reader.cancel().catch(() => {}) }
  deadline.addEventListener("abort", abort, { once: true })
  let bytes = 0
  let text = ""
  try {
    while (true) {
      if (deadline.aborted) throw timedOut()
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > limit) {
        await reader.cancel()
        throw tooLarge()
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } finally {
    deadline.removeEventListener("abort", abort)
    reader.releaseLock()
  }
  try {
    const body: unknown = JSON.parse(text)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error()
    return body as Record<string, unknown>
  } catch {
    throw new AppError("VALIDATION", "Please submit a valid JSON object.")
  }
}
