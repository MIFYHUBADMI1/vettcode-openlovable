/** Client navigated away, HMR cancelled a request, or a socket reset mid-write. */
export function isBenignDisconnect(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { name?: string; message?: string; code?: string }
  const code = err.code ?? ""
  const message = (err.message ?? "").toLowerCase()
  return (
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ECONNABORTED" ||
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    err.name === "AbortError" ||
    message === "aborted" ||
    message === "request aborted" ||
    message.includes("operation was aborted")
  )
}
