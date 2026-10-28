import type { MirrorProject, ProjectCreditBlock } from "@/lib/types/project"

export const CREDIT_BLOCK_FRESH_MS = 30 * 60 * 1000
export const CREDIT_BLOCK_HEADER = "x-credit-block"

export function sanitizeCreditBlock(value: unknown): ProjectCreditBlock | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const required = typeof raw.required === "number" && Number.isFinite(raw.required) && raw.required > 0
    ? Math.round(raw.required) : null
  const available = typeof raw.available === "number" && Number.isFinite(raw.available) && raw.available >= 0
    ? Math.round(raw.available) : null
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : null
  const action = typeof raw.action === "string" && raw.action.trim() ? raw.action.trim() : null
  if (required === null || available === null || at === null || action === null || required <= available) return null
  const resume = raw.resume === "build" || raw.resume === "analysis" ? raw.resume : undefined
  return { required, available, action, at, ...(resume ? { resume } : {}) }
}

export function freshCreditBlock(
  project: Pick<MirrorProject, "creditBlock"> & Partial<Pick<MirrorProject, "state" | "totalumProjectId" | "specification">> | null | undefined,
  now = Date.now(),
): ProjectCreditBlock | null {
  const block = sanitizeCreditBlock(project?.creditBlock)
  if (!block || now - block.at > CREDIT_BLOCK_FRESH_MS || block.at > now) return null
  if (project?.state) {
    const build = block.resume === "build" || block.action === "your build"
    if (build) {
      if (project.totalumProjectId || !["plan_ready", "awaiting_build_confirmation"].includes(project.state)) return null
    } else if (project.specification || !["analysis_failed", "plan_failed"].includes(project.state)) {
      return null
    }
  }
  return block
}

export function encodeCreditBlockHeader(block: ProjectCreditBlock): string {
  return encodeURIComponent(JSON.stringify(block))
}
