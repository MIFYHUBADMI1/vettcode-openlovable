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
