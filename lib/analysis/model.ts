import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const openrouter = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

/** Shared model used by all AI analysis steps (understanding + specification). */
export const MODEL = openrouter.chatModel("openrouter/auto")
