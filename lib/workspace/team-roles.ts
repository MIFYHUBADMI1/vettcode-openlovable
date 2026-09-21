import type { TeamRole } from "@/lib/workspace/workspace-view-model"

export const TEAM_ROLE_META: Record<TeamRole, { title: string; sub: string; initials: string; tone: string }> = {
  cofounder: { title: "Co-founder", sub: "Business · Strategy", initials: "CF", tone: "bg-rose-400 text-rose-950" },
  product: { title: "Product", sub: "UX · Features", initials: "PR", tone: "bg-sky-400 text-sky-950" },
  engineering: { title: "Engineering", sub: "Code · Integrations", initials: "EN", tone: "bg-violet-400 text-violet-950" },
  launch: { title: "Launch", sub: "Deployment · Growth", initials: "LN", tone: "bg-amber-400 text-amber-950" },
}

export function roleForStage(stage: string): TeamRole {
  const s = stage.toLowerCase()
  if (s.includes("deploy") || s.includes("launch")) return "launch"
  if (s.includes("build") || s.includes("agent") || s.includes("code")) return "engineering"
  if (s.includes("plan") || s.includes("spec") || s.includes("analy")) return "cofounder"
  return "product"
}

export function isFounderFacingEvent(event: { message: string }): boolean {
  const msg = event.message
  if (/Fetch (GET|POST|PUT|DELETE|PATCH)/i.test(msg)) return false
  if (/\/api\/v1\//i.test(msg)) return false
  if (/every \d+ seconds? to track/i.test(msg)) return false
  return true
}
