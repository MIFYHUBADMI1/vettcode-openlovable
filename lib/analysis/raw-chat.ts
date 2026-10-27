import { OPENROUTER_BASE_URL, MODEL_ID } from "@/lib/analysis/model"

/**
 * Tolerant, dependency-free completion call used to SALVAGE an answer the AI
 * SDK rejected.
 *
 * The SDK validates the provider's JSON against a strict schema, and a
 * free-tier provider that answers 200 with an unexpected shape (or whose body
 * is cut off in transit) makes it throw
 * `APICallError: Failed to process successful response` — the model DID write
 * the reply, the client just refused to read it. Here we parse the same
 * response by hand and take whatever text is in it, so the founder sees the
 * co-founder's answer instead of an error.
 */

export interface RawCompletion {
  text: string
  /** Provider stopped at the token limit, so the reply is incomplete. */
  truncated: boolean
}

interface ChatPart {
  type?: string
  text?: string
}

function joinParts(value: unknown): string {
  if (typeof value === "string") return value
  if (!Array.isArray(value)) return ""
  return value
    .map((part: unknown) => {
      if (typeof part === "string") return part
      const p = part as ChatPart
      return p?.type === "text" && typeof p.text === "string" ? p.text : ""
    })
    .join("")
}

/** Best-effort text from a body we could not parse as JSON. */
function salvageTruncatedBody(body: string): string {
  const match = /"content"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(body)
  if (!match) return ""
  // Re-quote the captured fragment so escapes decode correctly; a fragment cut
  // mid-escape gets a closing backslash removed first.
  const fragment = match[1].replace(/\\$/, "")
  try {
    return JSON.parse(`"${fragment}"`) as string
  } catch {
    return fragment.replace(/\\n/g, "\n").replace(/\\"/g, '"')
  }
}

export async function requestRawCompletion(options: {
  system: string
  prompt: string
  maxOutputTokens?: number
  timeoutMs?: number
}): Promise<RawCompletion | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000)

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
        max_tokens: options.maxOutputTokens ?? 2048,
        stream: false,
      }),
      signal: controller.signal,
    })

    const body = await response.text()
    if (!response.ok) return null

    let parsed: any
    try {
      parsed = JSON.parse(body)
    } catch {
      const partial = salvageTruncatedBody(body)
      return partial.trim() ? { text: partial.trim(), truncated: true } : null
    }
    if (parsed?.error) return null

    const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : undefined
    const message = choice?.message ?? choice
    // Some providers put the whole answer in the reasoning field and leave
    // `content` null — better than showing nothing.
    const text = [message?.content, message?.reasoning_content, message?.reasoning]
      .map(joinParts)
      .find((t) => t && t.trim().length > 0)

    if (!text?.trim()) return null
    return {
      text: text.trim(),
      truncated: String(choice?.finish_reason ?? "").toLowerCase() === "length",
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface RawStreamResult {
  /** Everything usable the provider sent, protocol markers included — the
   * caller parses the plan-update block out of it. */
  text: string
  /** The reply is incomplete (output limit or a stream that died early). */
  truncated: boolean
  /** Nothing arrived at all, so the caller should retry or refund. */
  failed: boolean
}

interface StreamLine {
  content?: string
  reasoning?: string
  hitLength?: boolean
  upstreamError?: boolean
}

/** One server-sent frame from the provider, read leniently. */
function readStreamLine(line: string): StreamLine {
  if (!line.startsWith("data:")) return {}
  const payload = line.slice(5).trim()
  if (!payload || payload === "[DONE]") return {}
  let parsed: any
  try {
    parsed = JSON.parse(payload)
  } catch {
    return {}
  }
  if (parsed?.error) return { upstreamError: true }
  const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : undefined
  const delta = choice?.delta ?? choice?.message ?? {}
  return {
    content: joinParts(delta?.content) || undefined,
    reasoning: joinParts(delta?.reasoning_content ?? delta?.reasoning) || undefined,
    hitLength: String(choice?.finish_reason ?? "").toLowerCase() === "length" || undefined,
  }
}

/**
 * Streaming variant of `requestRawCompletion`.
 *
 * The AI SDK buffers the whole provider payload and validates it against a
 * strict schema — which is both why a 30–90s free-tier answer arrives as one
 * silent wait and why an oddly-shaped 200 becomes
 * `Failed to process successful response`. This reads the same HTTP shape frame
 * by frame: `onDelta` sees the prose while it lands, and the caller still gets
 * the complete text back so plan-update protocol can be parsed from it.
 */
export async function streamRawCompletion(options: {
  system: string
  prompt: string
  maxOutputTokens?: number
  timeoutMs?: number
  /** The founder pressed Stop: cut the provider request, not just the UI. */
  abortSignal?: AbortSignal
  onDelta: (text: string) => void
}): Promise<RawStreamResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return { text: "", truncated: false, failed: true }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 180_000)
  const onExternalAbort = () => controller.abort()
  options.abortSignal?.addEventListener("abort", onExternalAbort, { once: true })
  const contentParts: string[] = []
  const reasoningParts: string[] = []
  let hitLength = false
  let errored = false

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
        max_tokens: options.maxOutputTokens ?? 4096,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!response.ok || !response.body) return { text: "", truncated: false, failed: true }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newlineAt = buffer.indexOf("\n")
      while (newlineAt !== -1) {
        const line = buffer.slice(0, newlineAt).trim()
        buffer = buffer.slice(newlineAt + 1)
        if (line) {
          const frame = readStreamLine(line)
          if (frame.upstreamError) errored = true
          if (frame.hitLength) hitLength = true
          if (frame.content) {
            contentParts.push(frame.content)
            options.onDelta(frame.content)
          }
          if (frame.reasoning) reasoningParts.push(frame.reasoning)
        }
        newlineAt = buffer.indexOf("\n")
      }
    }

    const content = contentParts.join("")
    // Some reasoning models answer entirely in the reasoning field and leave
    // content empty. Forwarding it at the end beats showing nothing.
    if (!content.trim()) {
      const reasoning = reasoningParts.join("")
      if (reasoning.trim()) {
        options.onDelta(reasoning)
        return { text: reasoning, truncated: hitLength, failed: false }
      }
    }
    const text = content
    if (!text.trim()) return { text: "", truncated: hitLength, failed: true }
    return { text, truncated: hitLength, failed: false }
  } catch {
    // An aborted or dropped stream still holds what the founder already saw.
    const text = contentParts.join("") || reasoningParts.join("")
    if (!text.trim()) return { text: "", truncated: hitLength || errored, failed: true }
    return { text, truncated: true, failed: false }
  } finally {
    clearTimeout(timer)
    options.abortSignal?.removeEventListener("abort", onExternalAbort)
  }
}
