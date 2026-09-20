// Type test: consumer-side declarations check (§51). Compiled with tsc
// --noEmit (see package.json "typecheck" script); never executed at runtime.
// Exercises the built declarations exactly as an external consumer would.
import { Atai, AtaiError } from "../../dist/index.js"
import type { AiChatInput, AiChatResult, AtaiConfig, AiUsage } from "../../dist/index.js"

const config: AtaiConfig = { apiKey: "atai_production_x", baseUrl: "https://runtime.test" }
const client: Atai = new Atai(config)

// Valid request compiles.
async function ok(): Promise<AiChatResult> {
  return client.ai.chat({ messages: [{ role: "user", content: "Hello" }] })
}

// Optional fields behave correctly.
const input: AiChatInput = { messages: [{ role: "assistant", content: "hi" }], temperature: 0.3, stop: ["END"] }
async function withOptions(signal: AbortSignal): Promise<AiChatResult> {
  return client.ai.chat(input, { signal })
}

// Errors are typed.
function handle(e: unknown): string | undefined {
  if (!(e instanceof AtaiError)) return undefined
  const code: string = e.code
  const reqId: string | undefined = e.requestId
  if (e.status === 429) return `${code}:${e.status}:${e.retry?.afterMs}`
  return `${code}:${reqId}`
}

// Usage type is usable.
function tokens(u: AiUsage | undefined): number | undefined {
  return u?.totalTokens
}

void ok; void withOptions; void handle; void tokens
