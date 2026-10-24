// Probe OpenRouter image routing per catalog model. All calls terminate at
// routing (400) or billing (402) — no generation, no cost.
import fs from "node:fs"
const key = fs.readFileSync(".env.local", "utf8").match(/^OPENROUTER_API_KEY=(.+)$/m)[1].trim().replace(/^["']|["']$/g, "")
const BLANK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
const PROMPT = "A clean modern SaaS dashboard UI mockup"

const modelIds = [
  "inclusionai/ming-image-0.1-design-layer",
  "openai/gpt-image-2.5-sunburst", "openai/gpt-image-2.5-flare", "openai/gpt-image-2",
  "openai/gpt-image-1", "openai/gpt-5-image",
  "google/gemini-nano-banana-2.1", "google/gemini-3.1-flash-image", "google/gemini-3-pro-image",
  "google/gemini-2.5-flash-image", "google/gemini-3.1-flash-lite-image",
  "black-forest-labs/flux-3-image", "black-forest-labs/flux.2-pro", "black-forest-labs/flux.2-max",
  "black-forest-labs/flux.2-flex",
  "recraft/recraft-v4.1-pro", "recraft/recraft-v4.1", "recraft/recraft-v4-styles-pro", "recraft/recraft-v3",
  "bytedance-seed/seedream-5-0-pro", "bytedance-seed/seedream-5-0-flash", "bytedance-seed/seedream-4.5",
  "x-ai/grok-imagine-image-2.0", "x-ai/grok-imagine-image-quality",
  "microsoft/mai-image-2.6", "microsoft/mai-image-2.6-flash",
  "qwen/qwen-image-3-pro", "qwen/qwen-image-3",
  "krea/krea-2-large", "sourceful/riverflow-v2.5-pro", "tencent/hy-image-v3.5-preview",
]

async function post(body) {
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", "X-Title": "Atai" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let msg = ""
  try { msg = JSON.parse(text)?.error?.message?.slice(0, 140) ?? "" } catch { msg = text.slice(0, 140) }
  return { status: res.status, msg }
}

for (const id of modelIds) {
  let caps = {}
  try {
    const r = await fetch(`https://openrouter.ai/api/v1/images/models/${id}/endpoints`)
    const j = await r.json()
    caps = j.endpoints?.[0]?.supported_parameters ?? {}
  } catch {}
  const capsKeys = Object.keys(caps).join(",")
  const refMin = caps.input_references?.min ?? 0
  const hasAR = "aspect_ratio" in caps
  const refs = [{ type: "image_url", image_url: { url: BLANK } }]

  // Variant A: capability-listed params only (+ refs when required)
  const a = { model: id, prompt: PROMPT }
  if (refMin >= 1) a.input_references = refs
  if (hasAR) a.aspect_ratio = "16:9"
  // Variant B: A + aspect_ratio (works unlisted for the default model)
  const b = { ...a, aspect_ratio: "16:9" }

  const ra = await post(a)
  const rb = hasAR ? { status: "-", msg: "(same as A)" } : await post(b)
  console.log([id, `caps=[${capsKeys}]`, `A=${ra.status}`, `B=${rb.status}`].join(" | "))
  if (ra.status !== 402 && ra.status !== 400) console.log("   A msg:", ra.msg)
  if (ra.status === 400) console.log("   A msg:", ra.msg)
  if (rb.status === 400) console.log("   B msg:", rb.msg)
}
