/**
 * Structured server-side logging (spec section 43). Never logs secrets — the
 * redactor strips anything that looks like an api key or token before output.
 */
type Fields = Record<string, unknown>

const SECRET_KEYS = /(api[_-]?key|token|secret|authorization|password|credential|private[_-]?key)/i

/** Secret-shaped VALUES even when the field name is innocuous (`detail`, `message`). */
const SECRET_VALUE =
  /(sk-[A-Za-z0-9_-]{8,}|whsec_[A-Za-z0-9_-]+|atai_(?:development|production)_[A-Za-z0-9_-]{8,}|Bearer\s+\S+|mongodb(\+srv)?:\/\/[^\s]+)/i

function redactString(value: string): string {
  if (SECRET_VALUE.test(value)) return "[redacted]"
  if (value.length > 500) return `${value.slice(0, 500)}…(${value.length} chars)`
  return value
}

function redactUnknown(value: unknown, depth: number): unknown {
  if (depth > 6) return "[truncated]"
  if (typeof value === "string") return redactString(value)
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => redactUnknown(item, depth + 1))
  if (value && typeof value === "object") {
    const out: Fields = {}
    for (const [k, v] of Object.entries(value as Fields)) {
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redactUnknown(v, depth + 1)
    }
    return out
  }
  return value
}

function redact(fields: Fields): Fields {
  return redactUnknown(fields, 0) as Fields
}

function emit(level: "info" | "warn" | "error", stage: string, message: string, fields?: Fields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    stage,
    message,
    ...(fields ? redact(fields) : {}),
  }
  const line = `[Atai] ${JSON.stringify(payload)}`
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (stage: string, message: string, fields?: Fields) => emit("info", stage, message, fields),
  warn: (stage: string, message: string, fields?: Fields) => emit("warn", stage, message, fields),
  error: (stage: string, message: string, fields?: Fields) => emit("error", stage, message, fields),
}
