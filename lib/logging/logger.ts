/**
 * Structured server-side logging (spec section 43). Never logs secrets — the
 * redactor strips anything that looks like an api key or token before output.
 */
type Fields = Record<string, unknown>

const SECRET_KEYS = /(api[_-]?key|token|secret|authorization|password)/i

function redact(fields: Fields): Fields {
  const out: Fields = {}
  for (const [k, v] of Object.entries(fields)) {
    if (SECRET_KEYS.test(k)) {
      out[k] = "[redacted]"
    } else if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…(${v.length} chars)`
    } else {
      out[k] = v
    }
  }
  return out
}

function emit(level: "info" | "warn" | "error", stage: string, message: string, fields?: Fields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    stage,
    message,
    ...(fields ? redact(fields) : {}),
  }
  const line = `[v0][mirrorsite] ${JSON.stringify(payload)}`
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (stage: string, message: string, fields?: Fields) => emit("info", stage, message, fields),
  warn: (stage: string, message: string, fields?: Fields) => emit("warn", stage, message, fields),
  error: (stage: string, message: string, fields?: Fields) => emit("error", stage, message, fields),
}
