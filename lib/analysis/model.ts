import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

const openrouter = createOpenAICompatible({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
})

/** 
 * Shared model used by all AI analysis steps (understanding + specification).
 * Model can be changed via OPENROUTER_MODEL environment variable.
 * Defaults to OPENROUTER_FREE_MODEL if OPENROUTER_MODEL is not set.
 * Falls back to openrouter/auto if neither is configured.
 */
const modelName = process.env.OPENROUTER_MODEL 
  || process.env.OPENROUTER_FREE_MODEL 
  || "openrouter/auto"

export const MODEL = openrouter.chatModel(modelName)

console.log(`[AI Model] Using: ${modelName}`)

